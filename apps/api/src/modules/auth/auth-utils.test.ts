import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const {
  assertUserAccess,
  ensureProjectAccess,
  requireScope
} = await import('./auth-utils.js');
const {
  ForbiddenProjectAccessError,
  ForbiddenTokenScopeError,
  ForbiddenUserAccessError,
  ProjectNotFoundError
} = await import('../../server/domain-errors.js');

type ActorContext = Parameters<typeof requireScope>[0];

type ProjectRecord = {
  id: string;
  userId: string;
};

function buildProjectsService(project: ProjectRecord | null, hasMembership = false) {
  const service = {
    getProjectById: async () => project,
    checkMembership: async () => hasMembership
  } as never;
  
  return Object.assign(service, {
    getSelectCalls: () => hasMembership ? 1 : 0
  });
}


const ownerActor: ActorContext = {
  userId: 'owner-user',
  role: 'user',
  scopes: ['projects:read', 'deployments:read']
};

const memberActor: ActorContext = {
  userId: 'member-user',
  role: 'user',
  scopes: ['projects:read']
};

const adminActor: ActorContext = {
  userId: 'admin-user',
  role: 'admin',
  scopes: []
};

const project: ProjectRecord = {
  id: 'project-1',
  userId: ownerActor.userId
};

test('assertUserAccess allows admin access to another user resource', () => {
  assert.doesNotThrow(() => assertUserAccess(adminActor, 'different-user'));
});

test('assertUserAccess rejects non-admin access to another user resource', () => {
  assert.throws(
    () => assertUserAccess(ownerActor, 'different-user'),
    ForbiddenUserAccessError
  );
});

test('requireScope allows admin access without explicit scopes', () => {
  assert.doesNotThrow(() => requireScope(adminActor, 'tokens:write'));
});

test('requireScope rejects user tokens that are missing the required scope', () => {
  assert.throws(
    () => requireScope(memberActor, 'tokens:write'),
    (error: unknown) => error instanceof ForbiddenTokenScopeError
      && error.message.includes('tokens:write')
  );
});

test('requireScope allows user tokens when the required scope is present', () => {
  assert.doesNotThrow(() => requireScope(ownerActor, 'projects:read'));
});

test('ensureProjectAccess throws ProjectNotFoundError when the project does not exist', async () => {
  const service = buildProjectsService(null);

  await assert.rejects(
    ensureProjectAccess(service, {
      projectId: 'missing-project',
      actor: ownerActor
    }),
    ProjectNotFoundError
  );
});

test('ensureProjectAccess allows project owners without membership lookup', async () => {
  const service = buildProjectsService(project);

  const result = await ensureProjectAccess(service, {
    projectId: project.id,
    actor: ownerActor
  });

  assert.deepEqual(result, project);
});

test('ensureProjectAccess allows admins without membership lookup', async () => {
  const service = buildProjectsService(project);

  const result = await ensureProjectAccess(service, {
    projectId: project.id,
    actor: adminActor
  });

  assert.deepEqual(result, project);
});

test('ensureProjectAccess allows project members when a membership row exists', async () => {
  const service = buildProjectsService(project, true);

  const result = await ensureProjectAccess(service, {
    projectId: project.id,
    actor: memberActor
  });

  assert.deepEqual(result, project);
});

test('ensureProjectAccess rejects non-owner users without project membership', async () => {
  const service = buildProjectsService(project, false);

  await assert.rejects(
    ensureProjectAccess(service, {
      projectId: project.id,
      actor: memberActor
    }),
    ForbiddenProjectAccessError
  );
});
