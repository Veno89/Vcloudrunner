import type { FastifyRequest } from 'fastify';

import { requireAuthContext, type AuthRole } from '../../plugins/auth-context.js';
import type { ProjectsService } from '../projects/projects.service.js';

interface ActorContext {
  userId: string;
  role: AuthRole;
}

export function requireActor(request: FastifyRequest): ActorContext {
  return requireAuthContext(request);
}

export function assertUserAccess(actor: ActorContext, targetUserId: string) {
  if (actor.role === 'admin') {
    return;
  }

  if (actor.userId !== targetUserId) {
    throw new Error('FORBIDDEN_USER_ACCESS');
  }
}

export async function ensureProjectAccess(
  projectsService: ProjectsService,
  input: { projectId: string; actor: ActorContext }
) {
  const project = await projectsService.getProjectById(input.projectId);
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  if (input.actor.role !== 'admin' && project.userId !== input.actor.userId) {
    throw new Error('FORBIDDEN_PROJECT_ACCESS');
  }

  return project;
}
