import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { DeploymentQueue } from '../../queue/deployment-queue.js';
import { ensureProjectAccess, requireActor, requireScope } from '../auth/auth-utils.js';
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

const deploymentParamsSchema = z.object({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid()
});

export const deploymentsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects/:projectId/deployments', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const payload = createDeploymentBodySchema.parse(request.body);

    requireScope(actor, 'deployments:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const deployment = await deploymentsService.createDeployment({
      projectId,
      correlationId: request.id,
      ...payload
    });

    return reply.code(201).send({ data: deployment });
  });

  app.get('/projects/:projectId/deployments', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);

    requireScope(actor, 'deployments:read');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const deployments = await deploymentsService.listDeployments(projectId);
    return { data: deployments };
  });

  app.post('/projects/:projectId/deployments/:deploymentId/cancel', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = deploymentParamsSchema.parse(request.params);

    requireScope(actor, 'deployments:cancel');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const result = await deploymentsService.cancelDeployment({
      projectId,
      deploymentId,
      correlationId: request.id
    });

    return reply.code(202).send({ data: result });
  });
};
