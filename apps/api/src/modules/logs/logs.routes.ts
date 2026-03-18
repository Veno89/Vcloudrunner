import type { FastifyPluginAsync } from 'fastify';
import { createGzip } from 'node:zlib';
import { PassThrough } from 'node:stream';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { ensureProjectAccess, requireActor, requireScope } from '../auth/auth-utils.js';
import { ProjectsService } from '../projects/projects.service.js';
import { LogsService } from './logs.service.js';

const logsService = new LogsService(db);
const projectsService = new ProjectsService(db);

const paramsSchema = z.object({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid()
});

const querySchema = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).default(200)
});

const streamQuerySchema = z.object({
  after: z.string().datetime().optional(),
  pollMs: z.coerce.number().min(1000).max(10000).default(2000)
});

const exportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['ndjson', 'ndjson.gz']).default('ndjson')
});

export const logsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects/:projectId/deployments/:deploymentId/logs', async (request) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = paramsSchema.parse(request.params);
    const { after, limit } = querySchema.parse(request.query);

    requireScope(actor, 'logs:read');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const data = await logsService.list(projectId, deploymentId, after, limit);
    return { data };
  });

  app.get('/projects/:projectId/deployments/:deploymentId/logs/stream', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = paramsSchema.parse(request.params);
    const { after, pollMs } = streamQuerySchema.parse(request.query);

    requireScope(actor, 'logs:read');
    await ensureProjectAccess(projectsService, { projectId, actor });

    reply.raw.setHeader('content-type', 'text/event-stream');
    reply.raw.setHeader('cache-control', 'no-cache, no-transform');
    reply.raw.setHeader('connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let lastTimestamp = after;

    const writeChunk = (chunk: string) => {
      if (closed || reply.raw.destroyed || reply.raw.writableEnded) {
        return false;
      }

      reply.raw.write(chunk);
      return true;
    };

    const closeStream = (message?: string) => {
      if (closed) {
        return;
      }

      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      if (message) {
        if (!reply.raw.destroyed && !reply.raw.writableEnded) {
          reply.raw.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
        }
      }

      closed = true;

      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.end();
      }
    };

    const sendLogs = async () => {
      if (closed || reply.raw.destroyed || reply.raw.writableEnded) {
        return;
      }

      const entries = await logsService.list(projectId, deploymentId, lastTimestamp, 200);

      if (closed || reply.raw.destroyed || reply.raw.writableEnded) {
        return;
      }

      if (entries.length === 0) {
        writeChunk(': keepalive\n\n');
        return;
      }

      for (const item of entries) {
        lastTimestamp = item.timestamp.toISOString();
        if (!writeChunk(`data: ${JSON.stringify({
          id: item.id,
          level: item.level,
          message: item.message,
          timestamp: item.timestamp
        })}\n\n`)) {
          return;
        }
      }
    };

    try {
      await sendLogs();
    } catch (error) {
      request.log.warn({ error, projectId, deploymentId }, 'initial live log stream send failed');
      closeStream('Live log streaming temporarily unavailable.');
      return reply.hijack();
    }

    intervalId = setInterval(() => {
      void sendLogs().catch((error) => {
        request.log.warn({ error, projectId, deploymentId }, 'live log stream polling failed');
        closeStream('Live log streaming temporarily unavailable.');
      });
    }, pollMs);

    request.raw.on('close', () => {
      closeStream();
    });

    return reply.hijack();
  });

  app.get('/projects/:projectId/deployments/:deploymentId/logs/export', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = paramsSchema.parse(request.params);
    const { from, to, format } = exportQuerySchema.parse(request.query);

    requireScope(actor, 'logs:read');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const data = await logsService.export(projectId, deploymentId, from, to);

    const source = new PassThrough();
    for (const item of data) {
      source.write(JSON.stringify({
        id: item.id,
        deploymentId: item.deploymentId,
        level: item.level,
        message: item.message,
        timestamp: item.timestamp
      }) + '\n');
    }
    source.end();

    if (format === 'ndjson.gz') {
      const fileName = `deployment-${deploymentId}-logs.ndjson.gz`;
      reply.header('content-type', 'application/gzip');
      reply.header('content-disposition', `attachment; filename="${fileName}"`);
      return reply.send(source.pipe(createGzip()));
    }

    const fileName = `deployment-${deploymentId}-logs.ndjson`;
    reply.header('content-type', 'application/x-ndjson; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="${fileName}"`);
    return reply.send(source);
  });
};
