import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
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
    const payload = createProjectSchema.parse(request.body);
    const project = await projectsService.createProject(payload);

    return reply.code(201).send({ data: project });
  });

  app.get('/users/:userId/projects', async (request) => {
    const { userId } = userProjectsParamsSchema.parse(request.params);
    const projects = await projectsService.listProjectsByUser(userId);

    return { data: projects };
  });

  app.get('/projects/:projectId', async (request, reply) => {
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    const project = await projectsService.getProjectById(projectId);

    if (!project) {
      return reply.notFound('Project not found');
    }

    return { data: project };
  });
};
