import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { LogsService } from './logs.service.js';

const logsService = new LogsService(db);

const paramsSchema = z.object({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid()
});

const querySchema = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).default(200)
});

export const logsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects/:projectId/deployments/:deploymentId/logs', async (request, reply) => {
    const { projectId, deploymentId } = paramsSchema.parse(request.params);
    const { after, limit } = querySchema.parse(request.query);

    try {
      const data = await logsService.list(projectId, deploymentId, after, limit);
      return { data };
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      if (error instanceof Error && error.message === 'DEPLOYMENT_NOT_FOUND') {
        return reply.notFound('Deployment not found');
      }
      throw error;
    }
  });
};
