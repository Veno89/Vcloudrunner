import type { FastifyPluginAsync } from 'fastify';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { ensureProjectAccess, requireActor } from '../auth/auth-utils.js';
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
  app.get('/projects/:projectId/deployments/:deploymentId/logs', async (request, reply) => {
    try {
      const actor = requireActor(request)
      const { projectId, deploymentId } = paramsSchema.parse(request.params);
      const { after, limit } = querySchema.parse(request.query);

      await ensureProjectAccess(projectsService, { projectId, actor });
      const data = await logsService.list(projectId, deploymentId, after, limit);
      return { data };
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_PROJECT_ACCESS') {
        return reply.forbidden('Project access denied');
      }
      if (error instanceof Error && error.message === 'DEPLOYMENT_NOT_FOUND') {
        return reply.notFound('Deployment not found');
      }
      throw error;
    }
  });

  app.get('/projects/:projectId/deployments/:deploymentId/logs/stream', async (request, reply) => {
    try {
      const actor = requireActor(request)
      const { projectId, deploymentId } = paramsSchema.parse(request.params);
      const { after, pollMs } = streamQuerySchema.parse(request.query);

      await ensureProjectAccess(projectsService, { projectId, actor });

      reply.raw.setHeader('content-type', 'text/event-stream');
      reply.raw.setHeader('cache-control', 'no-cache, no-transform');
      reply.raw.setHeader('connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      let lastTimestamp = after;
      const sendLogs = async () => {
        const entries = await logsService.list(projectId, deploymentId, lastTimestamp, 200);

        if (entries.length === 0) {
          reply.raw.write(': keepalive\n\n');
          return;
        }

        for (const item of entries) {
          lastTimestamp = item.timestamp.toISOString();
          reply.raw.write(`data: ${JSON.stringify({
            id: item.id,
            level: item.level,
            message: item.message,
            timestamp: item.timestamp
          })}\n\n`);
        }
      };

      await sendLogs();
      const intervalId = setInterval(() => {
        void sendLogs();
      }, pollMs);

      request.raw.on('close', () => {
        clearInterval(intervalId);
        if (!reply.raw.destroyed) {
          reply.raw.end();
        }
      });

      return reply.hijack();
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_PROJECT_ACCESS') {
        return reply.forbidden('Project access denied');
      }
      if (error instanceof Error && error.message === 'DEPLOYMENT_NOT_FOUND') {
        return reply.notFound('Deployment not found');
      }
      throw error;
    }
  });

  app.get('/projects/:projectId/deployments/:deploymentId/logs/export', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { projectId, deploymentId } = paramsSchema.parse(request.params);
      const { from, to, format } = exportQuerySchema.parse(request.query);

      await ensureProjectAccess(projectsService, { projectId, actor });
      const data = await logsService.export(projectId, deploymentId, from, to);

      const lines = data.map((item) => JSON.stringify({
        id: item.id,
        deploymentId: item.deploymentId,
        level: item.level,
        message: item.message,
        timestamp: item.timestamp
      }));
      const ndjson = lines.join('\n') + (lines.length > 0 ? '\n' : '');

      if (format === 'ndjson.gz') {
        const fileName = `deployment-${deploymentId}-logs.ndjson.gz`;
        reply.header('content-type', 'application/gzip');
        reply.header('content-disposition', `attachment; filename="${fileName}"`);
        return gzipSync(ndjson);
      }

      const fileName = `deployment-${deploymentId}-logs.ndjson`;
      reply.header('content-type', 'application/x-ndjson; charset=utf-8');
      reply.header('content-disposition', `attachment; filename="${fileName}"`);
      return ndjson;
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_PROJECT_ACCESS') {
        return reply.forbidden('Project access denied');
      }
      if (error instanceof Error && error.message === 'DEPLOYMENT_NOT_FOUND') {
        return reply.notFound('Deployment not found');
      }
      throw error;
    }
  });
};
