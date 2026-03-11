import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { assertUserAccess, requireActor } from '../auth/auth-utils.js';
import { ProjectsService } from './projects.service.js';

const projectsService = new ProjectsService(db);

const createProjectSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(3).max(64),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  gitRepositoryUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(255).optional()
});

const userProjectsParamsSchema = z.object({
  userId: z.string().uuid()
});

const projectByIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const payload = createProjectSchema.parse(request.body);

      try {
        assertUserAccess(actor, payload.userId);
      } catch {
        return reply.forbidden('Cannot create projects for another user');
      }

      const project = await projectsService.createProject(payload);

      return reply.code(201).send({ data: project });
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }
      if (error instanceof Error && error.message === 'PROJECT_SLUG_TAKEN') {
        return reply.conflict('Project slug is already in use');
      }

      throw error;
    }
  });

  app.get('/users/:userId/projects', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { userId } = userProjectsParamsSchema.parse(request.params);

      try {
        assertUserAccess(actor, userId);
      } catch {
        return reply.forbidden('Cannot list projects for another user');
      }

      const projects = await projectsService.listProjectsByUser(userId);

      return { data: projects };
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }

      throw error;
    }
  });

  app.get('/projects/:projectId', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { projectId } = projectByIdParamsSchema.parse(request.params);
      const project = await projectsService.getProjectById(projectId);

      if (!project) {
        return reply.notFound('Project not found');
      }

      if (actor.role !== 'admin' && project.userId !== actor.userId) {
        return reply.forbidden('Project access denied');
      }

      return { data: project };
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }

      throw error;
    }
  });
};
