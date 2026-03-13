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
import { db } from '../../db/client.js';
import { projectMembers } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';

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
    // Check project membership
    const membership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.actor.userId)
      ))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenProjectAccessError();
    }
  }

  return project;
}
