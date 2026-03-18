import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { Queue } from 'bullmq';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { deploymentsRoutes } from '../modules/deployments/deployments.routes.js';
import { apiTokensRoutes } from '../modules/api-tokens/api-tokens.routes.js';
import { authContextPlugin } from '../plugins/auth-context.js';
import { environmentRoutes } from '../modules/environment/environment.routes.js';
import { logsRoutes } from '../modules/logs/logs.routes.js';
import { projectsRoutes } from '../modules/projects/projects.routes.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { redisConnection } from '../queue/redis.js';
import { AlertMonitorService } from '../services/alert-monitor.service.js';

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

interface BuildServerDependencies {
  deploymentQueue?: DeploymentQueueClient;
  redisClient?: RedisClient;
  alertMonitor?: AlertMonitorClient;
}

export const buildServer = (dependencies: BuildServerDependencies = {}) => {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'api' },
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`
    }
  });

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

      callback(new Error('Origin not allowed by CORS'), false);
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
  app.register(authContextPlugin);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  app.addHook('onClose', async () => {
    alertMonitor.stop();
    await Promise.allSettled([deploymentQueue.close(), redisClient.quit()]);
  });

  alertMonitor.start();

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/queue', async (request, reply) => {
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

  app.get('/health/worker', async (request, reply) => {
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

  app.get('/metrics/queue', async (request, reply) => {
    try {
      return alertMonitor.getQueueMetrics();
    } catch (error) {
      request.log.error({ error }, 'queue metrics collection failed');
      return reply.code(503).send({
        status: 'unavailable',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get('/metrics/worker', async (request, reply) => {
    try {
      return alertMonitor.getWorkerHealth();
    } catch (error) {
      request.log.error({ error }, 'worker metrics collection failed');
      return reply.code(503).send({
        status: 'unavailable',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.register(projectsRoutes, { prefix: '/v1' });
  app.register(apiTokensRoutes, { prefix: '/v1' });
  app.register(deploymentsRoutes, { prefix: '/v1' });
  app.register(environmentRoutes, { prefix: '/v1' });
  app.register(logsRoutes, { prefix: '/v1' });

  return app;
};
