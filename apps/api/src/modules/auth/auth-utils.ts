import type { FastifyRequest } from 'fastify';

import { hasScope, type TokenScope } from './auth-scopes.js';
import { requireAuthContext, type AuthContext } from '../../plugins/auth-context.js';
import {
  ForbiddenProjectAccessError,
  ForbiddenProjectDeletionError,
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

export type ProjectAction = 'read' | 'manage_members' | 'transfer_ownership' | 'delete_project';

export async function ensureProjectAuthorized(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext; action: ProjectAction }
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

  if (input.action === 'read') {
    return project;
  }

  if (input.action === 'manage_members') {
    if (membership.role !== 'admin') {
      throw new ForbiddenProjectMembershipManagementError();
    }
    return project;
  }

  if (input.action === 'transfer_ownership') {
    throw new ForbiddenProjectOwnershipTransferError();
  }

  if (input.action === 'delete_project') {
    throw new ForbiddenProjectDeletionError();
  }

  return project;
}

export async function ensureProjectAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  return ensureProjectAuthorized(projectsService, { ...input, action: 'read' });
}

export async function ensureProjectMembershipManagementAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  return ensureProjectAuthorized(projectsService, { ...input, action: 'manage_members' });
}

export async function ensureProjectOwnershipTransferAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  return ensureProjectAuthorized(projectsService, { ...input, action: 'transfer_ownership' });
}

export async function ensureProjectDeletionAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  return ensureProjectAuthorized(projectsService, { ...input, action: 'delete_project' });
}
