import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ensureProjectAccess, requireActor, requireScope } from '../auth/auth-utils.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { EnvironmentService } from './environment.service.js';

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

export const createEnvironmentRoutes = (
  environmentService: EnvironmentService,
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {
  app.get('/projects/:projectId/environment-variables', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);

    requireScope(actor, 'environment:read');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const data = await environmentService.list(projectId);
    return { data };
  });

  app.put('/projects/:projectId/environment-variables', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const body = upsertBodySchema.parse(request.body);

    requireScope(actor, 'environment:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const data = await environmentService.upsert(projectId, body.key, body.value);
    return reply.code(201).send({ data });
  });

  app.delete('/projects/:projectId/environment-variables/:key', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, key } = removeParamsSchema.parse(request.params);

    requireScope(actor, 'environment:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    await environmentService.remove(projectId, key);
    return reply.code(204).send();
  });
};
