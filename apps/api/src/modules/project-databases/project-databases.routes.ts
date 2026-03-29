import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  ensureProjectAccess,
  ensureProjectMembershipManagementAccess,
  requireActor,
  requireScope
} from '../auth/auth-utils.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { ProjectDatabasesService } from './project-databases.service.js';

const projectByIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

const projectDatabaseByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  databaseId: z.string().uuid()
});

const serviceNamesSchema = z.array(
  z.string().trim().min(1).max(32).regex(/^[a-z][a-z0-9-]*$/)
).max(12);

const createProjectDatabaseSchema = z.object({
  name: z.string().trim().toLowerCase().min(1).max(48).regex(/^[a-z][a-z0-9-]*$/),
  serviceNames: serviceNamesSchema.default([])
});

const updateProjectDatabaseServiceLinksSchema = z.object({
  serviceNames: serviceNamesSchema.default([])
});

export const createProjectDatabasesRoutes = (
  projectDatabasesService: ProjectDatabasesService,
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {
  app.get('/projects/:projectId/databases', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    await ensureProjectAccess(projectsService, { projectId, actor });

    const databases = await projectDatabasesService.listProjectDatabases(projectId);

    return { data: databases };
  });

  app.post('/projects/:projectId/databases', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    const payload = createProjectDatabaseSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.createProjectDatabase({
      projectId,
      name: payload.name,
      serviceNames: payload.serviceNames
    });

    return reply.code(201).send({ data: database });
  });

  app.post('/projects/:projectId/databases/:databaseId/reconcile', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.reconcileProjectDatabase({
      projectId,
      databaseId
    });

    return { data: database };
  });

  app.post('/projects/:projectId/databases/:databaseId/rotate-credentials', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.rotateProjectDatabaseCredentials({
      projectId,
      databaseId
    });

    return { data: database };
  });

  app.put('/projects/:projectId/databases/:databaseId/service-links', async (request) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);
    const payload = updateProjectDatabaseServiceLinksSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const database = await projectDatabasesService.updateProjectDatabaseServiceLinks({
      projectId,
      databaseId,
      serviceNames: payload.serviceNames
    });

    return { data: database };
  });

  app.delete('/projects/:projectId/databases/:databaseId', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, databaseId } = projectDatabaseByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    await projectDatabasesService.removeProjectDatabase({
      projectId,
      databaseId
    });

    return reply.code(204).send();
  });
};
