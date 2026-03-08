import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { EnvironmentService } from './environment.service.js';

const environmentService = new EnvironmentService(db);

const projectIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

const upsertBodySchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z0-9_]+$/),
  value: z.string().max(5000)
});

const removeParamsSchema = z.object({
  projectId: z.string().uuid(),
  key: z.string().min(1).max(255)
});

export const environmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects/:projectId/environment-variables', async (request, reply) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);

    try {
      const data = await environmentService.list(projectId);
      return { data };
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      throw error;
    }
  });

  app.put('/projects/:projectId/environment-variables', async (request, reply) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const body = upsertBodySchema.parse(request.body);

    try {
      const data = await environmentService.upsert(projectId, body.key, body.value);
      return reply.code(201).send({ data });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      throw error;
    }
  });

  app.delete('/projects/:projectId/environment-variables/:key', async (request, reply) => {
    const { projectId, key } = removeParamsSchema.parse(request.params);

    try {
      await environmentService.remove(projectId, key);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }
      if (error instanceof Error && error.message === 'ENV_NOT_FOUND') {
        return reply.notFound('Environment variable not found');
      }
      throw error;
    }
  });
};
