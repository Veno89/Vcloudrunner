import type { FastifyRequest } from 'fastify';

import { hasScope, type TokenScope } from './auth-scopes.js';
import { requireAuthContext, type AuthRole } from '../../plugins/auth-context.js';
import {
  ForbiddenProjectAccessError,
  ForbiddenTokenScopeError,
  ForbiddenUserAccessError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';
import type { ProjectsService } from '../projects/projects.service.js';

interface ActorContext {
  userId: string;
  role: AuthRole;
  scopes: TokenScope[];
}

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
    throw new ForbiddenProjectAccessError();
  }

  return project;
}
