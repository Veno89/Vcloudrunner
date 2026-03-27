import type { FastifyRequest } from 'fastify';

import { hasScope, type TokenScope } from './auth-scopes.js';
import { requireAuthContext, type AuthContext } from '../../plugins/auth-context.js';
import {
  ForbiddenProjectAccessError,
  ForbiddenProjectMembershipManagementError,
  ForbiddenProjectOwnershipTransferError,
  ForbiddenTokenScopeError,
  ForbiddenUserAccessError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';
import type { ProjectsService } from '../projects/projects.service.js';

type ActorContext = AuthContext;

export function requireActor(request: FastifyRequest): ActorContext {
  return requireAuthContext(request);
}

export function assertUserAccess(actor: ActorContext, targetUserId: string) {
  if (actor.role === 'admin') {
    return;
  }

  if (actor.userId !== targetUserId) {
    throw new ForbiddenUserAccessError();
  }
}

export function requireScope(actor: ActorContext, scope: TokenScope) {
  if (actor.role === 'admin') {
    return;
  }

  if (!hasScope(actor.scopes, scope)) {
    throw new ForbiddenTokenScopeError(scope);
  }
}

export async function ensureProjectAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  const project = await projectsService.getProjectById(input.projectId);
  if (!project) {
    throw new ProjectNotFoundError();
  }

  if (input.actor.role !== 'admin' && project.userId !== input.actor.userId) {
    // Check project membership
    const hasAccess = await projectsService.checkMembership(
      input.projectId,
      input.actor.userId
    );

    if (!hasAccess) {
      throw new ForbiddenProjectAccessError();
    }
  }

  return project;
}

export async function ensureProjectMembershipManagementAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  const project = await projectsService.getProjectById(input.projectId);
  if (!project) {
    throw new ProjectNotFoundError();
  }

  if (input.actor.role === 'admin' || project.userId === input.actor.userId) {
    return project;
  }

  const membership = await projectsService.getMembership(
    input.projectId,
    input.actor.userId
  );

  if (!membership) {
    throw new ForbiddenProjectAccessError();
  }

  if (membership.role !== 'admin') {
    throw new ForbiddenProjectMembershipManagementError();
  }

  return project;
}

export async function ensureProjectOwnershipTransferAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  const project = await projectsService.getProjectById(input.projectId);
  if (!project) {
    throw new ProjectNotFoundError();
  }

  if (input.actor.role === 'admin' || project.userId === input.actor.userId) {
    return project;
  }

  const membership = await projectsService.getMembership(
    input.projectId,
    input.actor.userId
  );

  if (!membership) {
    throw new ForbiddenProjectAccessError();
  }

  throw new ForbiddenProjectOwnershipTransferError();
}
