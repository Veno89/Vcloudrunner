import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { Queue } from 'bullmq';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { DeploymentQueue } from '../queue/deployment-queue.js';
import { env } from '../config/env.js';
import { createDbClient, type DbClient } from '../db/client.js';
import { createDeploymentsRoutes } from '../modules/deployments/deployments.routes.js';
import { DeploymentsService } from '../modules/deployments/deployments.service.js';
import { createApiTokensRoutes } from '../modules/api-tokens/api-tokens.routes.js';
import { ApiTokensService } from '../modules/api-tokens/api-tokens.service.js';
import { authContextPlugin } from '../plugins/auth-context.js';
import { createEnvironmentRoutes } from '../modules/environment/environment.routes.js';
import { EnvironmentService } from '../modules/environment/environment.service.js';
import { createLogsRoutes } from '../modules/logs/logs.routes.js';
import { LogsService } from '../modules/logs/logs.service.js';
import { createProjectsRoutes } from '../modules/projects/projects.routes.js';
import { ProjectsService } from '../modules/projects/projects.service.js';
import { createAuthRoutes } from '../modules/auth/auth.routes.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { createProjectDatabasesRoutes } from '../modules/project-databases/project-databases.routes.js';
import { ProjectDatabasesService } from '../modules/project-databases/project-databases.service.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { redisConnection } from '../queue/redis.js';
import { AlertMonitorService } from '../services/alert-monitor.service.js';
import { ProjectDomainDiagnosticsRefreshService } from '../services/project-domain-diagnostics-refresh.service.js';
import { WebhookProjectInvitationDeliveryService } from '../services/project-invitation-delivery.service.js';
import { GitHubAppService } from '../modules/github/github-app.service.js';
import { createGitHubRoutes } from '../modules/github/github.routes.js';

interface DeploymentQueueClient {
  close(): Promise<void>;
}

interface RedisClient {
  ping(): Promise<string>;
  quit(): Promise<unknown>;
}

type AlertMonitorClient = Pick<
  AlertMonitorService,
  'start' | 'stop' | 'getQueueMetrics' | 'getWorkerHealth'
>;

type ProjectDomainDiagnosticsRefreshClient = Pick<
  ProjectDomainDiagnosticsRefreshService,
  'start' | 'stop'
>;

interface BuildServerDependencies {
  dbClient?: DbClient;
  deploymentQueue?: DeploymentQueueClient;
  redisClient?: RedisClient;
  alertMonitor?: AlertMonitorClient;
  projectDomainDiagnosticsRefresh?: ProjectDomainDiagnosticsRefreshClient;
}

type StatusCodeError = Error & {
  statusCode?: number;
};

function createStatusCodeError(message: string, statusCode: number) {
  const error = new Error(message) as StatusCodeError;
  error.statusCode = statusCode;
  return error;
}

export const buildServer = (dependencies: BuildServerDependencies = {}) => {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'api' },
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`
    }
  });

  const dbClient = dependencies.dbClient ?? createDbClient();
  const deploymentQueue = dependencies.deploymentQueue
    ?? new Queue<DeploymentJobPayload, unknown, 'deploy'>(QUEUE_NAMES.deployment, {
      connection: redisConnection
    });
  const redisClient = dependencies.redisClient
    ?? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

  const alertMonitor = dependencies.alertMonitor
    ?? new AlertMonitorService(
      deploymentQueue as Queue<DeploymentJobPayload, unknown, 'deploy'>,
      redisClient as Redis,
      QUEUE_NAMES.deployment,
      app.log
    );

  const deploymentQueueClient = new DeploymentQueue(deploymentQueue as Pick<Queue<DeploymentJobPayload, unknown, 'deploy'>, 'add' | 'getJobs' | 'getJob'> & Partial<Pick<Queue<DeploymentJobPayload, unknown, 'deploy'>, 'close'>>);

  const projectDatabasesService = new ProjectDatabasesService(dbClient);
  const projectsService = new ProjectsService(
    dbClient,
    new WebhookProjectInvitationDeliveryService(),
    undefined,
    undefined,
    projectDatabasesService
  );
  const projectDomainDiagnosticsRefresh = dependencies.projectDomainDiagnosticsRefresh
    ?? new ProjectDomainDiagnosticsRefreshService(projectsService, app.log);
  const apiTokensService = new ApiTokensService(dbClient);

  const githubAppService = new GitHubAppService(dbClient, {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    appSlug: env.GITHUB_APP_SLUG,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET
  });

  const deploymentsService = new DeploymentsService(dbClient, deploymentQueueClient, {
    projectDatabasesService,
    githubTokenProvider: githubAppService
  });
  const environmentService = new EnvironmentService(dbClient);
  const logsService = new LogsService(dbClient);
  const authService = new AuthService(dbClient);

  const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const rateLimitAllowList = env.API_RATE_LIMIT_ALLOWLIST
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  app.register(cors, {
    credentials: env.CORS_ALLOW_CREDENTIALS,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(createStatusCodeError('Origin not allowed by CORS', 403), false);
    }
  });

  app.register(rateLimit, {
    global: true,
    max: env.API_RATE_LIMIT_MAX,
    timeWindow: env.API_RATE_LIMIT_WINDOW_MS,
    allowList: rateLimitAllowList,
    skipOnError: true,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true
    }
  });

  app.register(sensible);
  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  app.addHook('onClose', async () => {
    alertMonitor.stop();
    projectDomainDiagnosticsRefresh.stop();
    await Promise.allSettled([deploymentQueue.close(), redisClient.quit()]);
  });

  alertMonitor.start();
  projectDomainDiagnosticsRefresh.start();

  app.register(async (routeApp) => {
    routeApp.get('/health', async () => ({ status: 'ok' }));

    routeApp.get('/health/queue', async (request, reply) => {
      try {
        const ping = await redisClient.ping();
        const metrics = await alertMonitor.getQueueMetrics();

        return {
          status: ping === 'PONG' ? 'ok' : 'degraded',
          redis: ping,
          ...metrics
        };
      } catch (error) {
        request.log.error({ error }, 'queue health check failed');
        return reply.code(503).send({
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    routeApp.get('/health/worker', async (request, reply) => {
      try {
        const worker = await alertMonitor.getWorkerHealth();
        if (worker.status !== 'ok') {
          return reply.code(503).send(worker);
        }

        return worker;
      } catch (error) {
        request.log.error({ error }, 'worker health check failed');
        return reply.code(503).send({
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    routeApp.get('/metrics/queue', async (request, reply) => {
      try {
        return await alertMonitor.getQueueMetrics();
      } catch (error) {
        request.log.error({ error }, 'queue metrics collection failed');
        return reply.code(503).send({
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    routeApp.get('/metrics/worker', async (request, reply) => {
      try {
        return await alertMonitor.getWorkerHealth();
      } catch (error) {
        request.log.error({ error }, 'worker metrics collection failed');
        return reply.code(503).send({
          status: 'unavailable',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    routeApp.register(createAuthRoutes(authService), { prefix: '/v1' });
    routeApp.register(createProjectsRoutes(projectsService), { prefix: '/v1' });
    routeApp.register(createProjectDatabasesRoutes(projectDatabasesService, projectsService), { prefix: '/v1' });
    routeApp.register(createApiTokensRoutes(apiTokensService), { prefix: '/v1' });
    routeApp.register(createDeploymentsRoutes(deploymentsService, projectsService), { prefix: '/v1' });
    routeApp.register(createEnvironmentRoutes(environmentService, projectsService), { prefix: '/v1' });
    routeApp.register(createLogsRoutes(logsService, projectsService), { prefix: '/v1' });
    routeApp.register(createGitHubRoutes(githubAppService), { prefix: '/v1' });
  });

  return app;
};
