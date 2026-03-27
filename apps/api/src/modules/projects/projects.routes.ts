import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import {
  assertUserAccess,
  ensureProjectAccess,
  ensureProjectMembershipManagementAccess,
  ensureProjectOwnershipTransferAccess,
  requireActor,
  requireScope
} from '../auth/auth-utils.js';
import type { ProjectsService } from './projects.service.js';

function isValidServiceSourceRoot(value: string) {
  return (
    value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').some((segment) => segment === '..')
  );
}

const projectServiceRuntimeSchema = z.object({
  containerPort: z.number().int().min(1).max(65535).optional(),
  memoryMb: z.number().int().min(1).max(262144).optional(),
  cpuMillicores: z.number().int().min(1).max(256000).optional()
}).optional();

const projectServicesSchema = z.array(z.object({
  name: z.string().min(1).max(32).regex(/^[a-z][a-z0-9-]*$/),
  kind: z.enum(['web', 'worker']),
  sourceRoot: z.string().min(1).max(255).refine(
    isValidServiceSourceRoot,
    'sourceRoot must be a repo-relative POSIX path and cannot escape the repository root'
  ),
  exposure: z.enum(['public', 'internal']),
  runtime: projectServiceRuntimeSchema
})).min(1).max(12).superRefine((services, ctx) => {
  const seenNames = new Set<string>();
  let publicServiceCount = 0;

  for (const [index, service] of services.entries()) {
    if (seenNames.has(service.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'name'],
        message: 'service names must be unique within a project'
      });
    }

    seenNames.add(service.name);

    if (service.exposure === 'public') {
      publicServiceCount += 1;

      if (service.kind !== 'web') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'kind'],
          message: 'public services must currently use the web kind'
        });
      }
    }
  }

  if (publicServiceCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'projects must currently define exactly one public service'
    });
  }
});

const createProjectSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(3).max(64),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  gitRepositoryUrl: z.string().url(),
  defaultBranch: z.string().min(1).max(255).optional(),
  services: projectServicesSchema.optional()
});

const userProjectsParamsSchema = z.object({
  userId: z.string().uuid()
});

const projectByIdParamsSchema = z.object({
  projectId: z.string().uuid()
});

const projectMemberByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  memberUserId: z.string().uuid()
});

const projectInvitationByIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  invitationId: z.string().uuid()
});

const projectInvitationClaimParamsSchema = z.object({
  claimToken: z.string().trim().min(8).max(64).regex(/^[a-z0-9-]+$/i)
});

const projectMemberRoleSchema = z.enum(['viewer', 'editor', 'admin']);

const inviteProjectMemberSchema = z.object({
  email: z.string().trim().max(320).email(),
  role: projectMemberRoleSchema.default('viewer')
});

const updateProjectMemberSchema = z.object({
  role: projectMemberRoleSchema
});

const transferProjectOwnershipSchema = z.object({
  userId: z.string().uuid()
});

export const createProjectsRoutes = (
  projectsService: ProjectsService
): FastifyPluginAsync => async (app) => {
  app.get('/project-invitations/claim/:claimToken', async (request) => {
    const { claimToken } = projectInvitationClaimParamsSchema.parse(request.params);

    const invitation = await projectsService.getProjectInvitationClaim(claimToken);

    return { data: invitation };
  });

  app.post('/project-invitations/claim/:claimToken/accept', async (request) => {
    const actor = requireActor(request);
    const { claimToken } = projectInvitationClaimParamsSchema.parse(request.params);

    const invitation = await projectsService.acceptProjectInvitationClaim({
      claimToken,
      actorUserId: actor.userId
    });

    return { data: invitation };
  });

  app.post('/projects', async (request, reply) => {
    const actor = requireActor(request);
    const payload = createProjectSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    assertUserAccess(actor, payload.userId);

    const project = await projectsService.createProject(payload);

    return reply.code(201).send({ data: project });
  });

  app.get('/users/:userId/projects', async (request) => {
    const actor = requireActor(request);
    const { userId } = userProjectsParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    assertUserAccess(actor, userId);

    const projects = await projectsService.listProjectsByUser(userId);

    return { data: projects };
  });

  app.get('/projects/:projectId', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    requireScope(actor, 'projects:read');
    const project = await ensureProjectAccess(projectsService, { projectId, actor });

    return { data: project };
  });

  app.get('/projects/:projectId/members', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    await ensureProjectAccess(projectsService, { projectId, actor });

    const members = await projectsService.listProjectMembers(projectId);

    return { data: members };
  });

  app.get('/projects/:projectId/invitations', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:read');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const invitations = await projectsService.listProjectInvitations(projectId);

    return { data: invitations };
  });

  app.post('/projects/:projectId/members', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    const payload = inviteProjectMemberSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const member = await projectsService.inviteProjectMember({
      projectId,
      email: payload.email,
      role: payload.role,
      invitedBy: actor.userId
    });

    return reply.code(201).send({ data: member });
  });

  app.put('/projects/:projectId/invitations/:invitationId', async (request) => {
    const actor = requireActor(request);
    const { projectId, invitationId } = projectInvitationByIdParamsSchema.parse(request.params);
    const payload = updateProjectMemberSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const invitation = await projectsService.updateProjectInvitation({
      projectId,
      invitationId,
      role: payload.role,
      invitedBy: actor.userId
    });

    return { data: invitation };
  });

  app.delete('/projects/:projectId/invitations/:invitationId', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, invitationId } = projectInvitationByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    await projectsService.removeProjectInvitation({
      projectId,
      invitationId
    });

    return reply.code(204).send();
  });

  app.post('/projects/:projectId/invitations/:invitationId/redeliver', async (request) => {
    const actor = requireActor(request);
    const { projectId, invitationId } = projectInvitationByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const result = await projectsService.redeliverProjectInvitation({
      projectId,
      invitationId
    });

    return { data: result };
  });

  app.put('/projects/:projectId/members/:memberUserId', async (request) => {
    const actor = requireActor(request);
    const { projectId, memberUserId } = projectMemberByIdParamsSchema.parse(request.params);
    const payload = updateProjectMemberSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    const member = await projectsService.updateProjectMemberRole({
      projectId,
      userId: memberUserId,
      role: payload.role
    });

    return { data: member };
  });

  app.delete('/projects/:projectId/members/:memberUserId', async (request, reply) => {
    const actor = requireActor(request);
    const { projectId, memberUserId } = projectMemberByIdParamsSchema.parse(request.params);

    requireScope(actor, 'projects:write');
    await ensureProjectMembershipManagementAccess(projectsService, { projectId, actor });

    await projectsService.removeProjectMember({
      projectId,
      userId: memberUserId
    });

    return reply.code(204).send();
  });

  app.post('/projects/:projectId/ownership', async (request) => {
    const actor = requireActor(request);
    const { projectId } = projectByIdParamsSchema.parse(request.params);
    const payload = transferProjectOwnershipSchema.parse(request.body);

    requireScope(actor, 'projects:write');
    await ensureProjectOwnershipTransferAccess(projectsService, { projectId, actor });

    const member = await projectsService.transferProjectOwnership({
      projectId,
      userId: payload.userId
    });

    return { data: member };
  });
};
