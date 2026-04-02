import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ensureProjectAccess, requireActor, requireScope } from '../auth/auth-utils.js';
import type { ProjectsService } from '../projects/projects.service.js';
import type { DeploymentsService } from './deployments.service.js';

const healthCheckSchema = z.object({
  command: z.string().min(1).max(500),
  intervalSeconds: z.number().int().min(1).max(300).default(30),
  timeoutSeconds: z.number().int().min(1).max(60).default(5),
  retries: z.number().int().min(1).max(10).default(3),
  startPeriodSeconds: z.number().int().min(0).max(300).default(10)
});

const runtimeSchema = z.object({
  containerPort: z.number().int().min(1).max(65535).optional(),
  memoryMb: z.number().int().min(64).optional(),
  cpuMillicores: z.number().int().min(100).optional(),
  healthCheck: healthCheckSchema.optional(),
  restartPolicy: z.enum(['no', 'always', 'unless-stopped', 'on-failure']).optional()
});

const createDeploymentBodySchema = z.object({
  commitSha: z.string().min(7).max(64).optional(),
  branch: z.string().min(1).max(255).optional(),
  serviceName: z.string().min(1).max(32).regex(/^[a-z][a-z0-9-]*$/).optional(),
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

const deployAllBodySchema = z.object({
  commitSha: z.string().min(7).max(64).optional(),
  branch: z.string().min(1).max(255).optional()
});

export const createDeploymentsRoutes = (
  deploymentsService: DeploymentsService,
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {

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

  app.post('/projects/:projectId/deployments/all', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const payload = deployAllBodySchema.parse(request.body ?? {});

    requireScope(actor, 'deployments:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const results = await deploymentsService.deployAllServices({
      projectId,
      correlationId: request.id,
      ...payload
    });

    return reply.code(201).send({ data: results });
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

  app.post('/projects/:projectId/deployments/:deploymentId/redeploy', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = deploymentParamsSchema.parse(request.params);

    requireScope(actor, 'deployments:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const deployment = await deploymentsService.redeployFromDeployment({
      projectId,
      deploymentId,
      correlationId: request.id
    });

    return reply.code(201).send({ data: deployment });
  });

  app.post('/projects/:projectId/deployments/:deploymentId/rollback', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, deploymentId } = deploymentParamsSchema.parse(request.params);

    requireScope(actor, 'deployments:write');
    await ensureProjectAccess(projectsService, { projectId, actor });
    const deployment = await deploymentsService.rollbackToDeployment({
      projectId,
      deploymentId,
      correlationId: request.id
    });

    return reply.code(201).send({ data: deployment });
  });
};
