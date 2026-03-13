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

interface WorkerHeartbeat {
  timestamp: string;
  service?: string;
  pid?: number;
}

interface AlertPayload {
  key: string;
  severity: 'warn' | 'critical';
  message: string;
  details: Record<string, unknown>;
}

export const buildServer = () => {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'api' },
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`
    }
  });

  const deploymentQueue = new Queue<DeploymentJobPayload, unknown, 'deploy'>(QUEUE_NAMES.deployment, {
    connection: redisConnection
  });
  const redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
  const lastAlertAtByKey = new Map<string, number>();

  const getQueueMetrics = async () => {
    const counts = await deploymentQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'prioritized');
    return {
      queue: QUEUE_NAMES.deployment,
      counts,
      sampledAt: new Date().toISOString()
    };
  };

  const getWorkerHealth = async () => {
    const rawHeartbeat = await redisClient.get(env.WORKER_HEARTBEAT_KEY);
    if (!rawHeartbeat) {
      return {
        status: 'unavailable' as const,
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat not found'
      };
    }

    let heartbeat: WorkerHeartbeat;
    try {
      heartbeat = JSON.parse(rawHeartbeat) as WorkerHeartbeat;
    } catch {
      return {
        status: 'unavailable' as const,
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat payload is invalid JSON'
      };
    }

    const parsedTimestamp = Date.parse(heartbeat.timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      return {
        status: 'unavailable' as const,
        heartbeatKey: env.WORKER_HEARTBEAT_KEY,
        staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
        message: 'Worker heartbeat payload is missing a valid timestamp'
      };
    }

    const ageMs = Date.now() - parsedTimestamp;

    return {
      status: ageMs <= env.WORKER_HEARTBEAT_STALE_MS ? 'ok' as const : 'stale' as const,
      heartbeatKey: env.WORKER_HEARTBEAT_KEY,
      staleAfterMs: env.WORKER_HEARTBEAT_STALE_MS,
      ageMs,
      timestamp: heartbeat.timestamp,
      service: heartbeat.service ?? 'worker',
      pid: heartbeat.pid ?? null
    };
  };

  const sendAlert = async (payload: AlertPayload) => {
    const webhookUrl = env.ALERT_WEBHOOK_URL.trim();
    if (webhookUrl.length === 0) {
      return;
    }

    const now = Date.now();
    const lastAlertAt = lastAlertAtByKey.get(payload.key);
    if (typeof lastAlertAt === 'number' && now - lastAlertAt < env.ALERT_COOLDOWN_MS) {
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.ALERT_WEBHOOK_AUTH_TOKEN.trim().length > 0
          ? { authorization: `Bearer ${env.ALERT_WEBHOOK_AUTH_TOKEN}` }
          : {})
      },
      body: JSON.stringify({
        source: 'api',
        ...payload,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`alert webhook responded with status ${response.status}`);
    }

    lastAlertAtByKey.set(payload.key, now);
  };

  const evaluateOperationalAlerts = async () => {
    const queueMetrics = await getQueueMetrics();
    const workerHealth = await getWorkerHealth();

    if (workerHealth.status !== 'ok') {
      await sendAlert({
        key: `worker-health:${workerHealth.status}`,
        severity: 'critical',
        message: 'Worker health degraded',
        details: workerHealth
      });
    }

    if (queueMetrics.counts.waiting >= env.ALERT_QUEUE_WAITING_THRESHOLD) {
      await sendAlert({
        key: 'queue-waiting-threshold',
        severity: 'warn',
        message: 'Deployment queue waiting backlog exceeded threshold',
        details: {
          waiting: queueMetrics.counts.waiting,
          threshold: env.ALERT_QUEUE_WAITING_THRESHOLD,
          queue: queueMetrics.queue
        }
      });
    }

    if (queueMetrics.counts.active >= env.ALERT_QUEUE_ACTIVE_THRESHOLD) {
      await sendAlert({
        key: 'queue-active-threshold',
        severity: 'warn',
        message: 'Deployment queue active jobs exceeded threshold',
        details: {
          active: queueMetrics.counts.active,
          threshold: env.ALERT_QUEUE_ACTIVE_THRESHOLD,
          queue: queueMetrics.queue
        }
      });
    }

    if (queueMetrics.counts.failed >= env.ALERT_QUEUE_FAILED_THRESHOLD) {
      await sendAlert({
        key: 'queue-failed-threshold',
        severity: 'critical',
        message: 'Deployment queue failed jobs exceeded threshold',
        details: {
          failed: queueMetrics.counts.failed,
          threshold: env.ALERT_QUEUE_FAILED_THRESHOLD,
          queue: queueMetrics.queue
        }
      });
    }
  };

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
    clearInterval(alertMonitorInterval);
    await Promise.allSettled([deploymentQueue.close(), redisClient.quit()]);
  });

  const alertMonitorInterval = setInterval(() => {
    void evaluateOperationalAlerts().catch((error) => {
      app.log.warn({ error }, 'operational alert evaluation failed');
    });
  }, env.ALERT_MONITOR_INTERVAL_MS);

  void evaluateOperationalAlerts().catch((error) => {
    app.log.warn({ error }, 'initial operational alert evaluation failed');
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/queue', async (request, reply) => {
    try {
      const ping = await redisClient.ping();
      const metrics = await getQueueMetrics();

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
      const worker = await getWorkerHealth();
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
      return getQueueMetrics();
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
      return getWorkerHealth();
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
