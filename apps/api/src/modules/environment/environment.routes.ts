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

  app.get('/projects/:projectId/environment-variables/export', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);

    requireScope(actor, 'environment:read');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const content = await environmentService.exportAsEnvFile(projectId);

    return reply
      .header('content-type', 'text/plain; charset=utf-8')
      .header('content-disposition', 'attachment; filename=".env"')
      .send(content);
  });

  app.post('/projects/:projectId/environment-variables/import', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);

    requireScope(actor, 'environment:write');
    await ensureProjectAccess(projectsService, { projectId, actor });

    const body = request.body;
    let content: string;
    if (typeof body === 'string') {
      content = body;
    } else if (body && typeof body === 'object' && 'content' in body) {
      content = String((body as { content: unknown }).content);
    } else {
      return reply.code(400).send({ error: 'Request body must be a string or { content: string }' });
    }

    const result = await environmentService.importFromEnvFile(projectId, content);
    return reply.code(200).send({ data: result });
  });
};
