import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { DeploymentQueue } from '../../queue/deployment-queue.js';
import { ProjectsService } from '../projects/projects.service.js';
import { DeploymentsService } from './deployments.service.js';

const deploymentsService = new DeploymentsService(db, new DeploymentQueue());
const projectsService = new ProjectsService(db);

const runtimeSchema = z.object({
  containerPort: z.number().int().min(1).max(65535).optional(),
  memoryMb: z.number().int().min(64).optional(),
  cpuMillicores: z.number().int().min(100).optional()
});

const createDeploymentBodySchema = z.object({
  commitSha: z.string().min(7).max(64).optional(),
  branch: z.string().min(1).max(255).optional(),
  runtime: runtimeSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

const projectIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

export const deploymentsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects/:projectId/deployments', async (request, reply) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const payload = createDeploymentBodySchema.parse(request.body);

    try {
      const deployment = await deploymentsService.createDeployment({
        projectId,
        ...payload
      });

      return reply.code(201).send({ data: deployment });
    } catch (error) {
      if (error instanceof Error && error.message === 'PROJECT_NOT_FOUND') {
        return reply.notFound('Project not found');
      }

      throw error;
    }
  });

  app.get('/projects/:projectId/deployments', async (request, reply) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);

    const project = await projectsService.getProjectById(projectId);
    if (!project) {
      return reply.notFound('Project not found');
    }

    const deployments = await deploymentsService.listDeployments(projectId);
    return { data: deployments };
  });
};
