import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

const { db } = await import('../../db/client.js');
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

function buildProjectsService(project: ProjectRecord | null) {
  return {
    getProjectById: async () => project
  } as never;
}

function mockMembershipLookup(t: TestContext, rows: Array<{ role: string }>) {
  let selectCalls = 0;

  t.mock.method(db as { select: (...args: unknown[]) => unknown }, 'select', () => {
    selectCalls += 1;

    return {
      from() {
        return {
          where() {
            return {
              limit: async () => rows
            };
          }
        };
      }
    };
  });

  return {
    getSelectCalls: () => selectCalls
  };
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

test('ensureProjectAccess throws ProjectNotFoundError when the project does not exist', async (t) => {
  const membershipLookup = mockMembershipLookup(t, []);

  await assert.rejects(
    ensureProjectAccess(buildProjectsService(null), {
      projectId: 'missing-project',
      actor: ownerActor
    }),
    ProjectNotFoundError
  );

  assert.equal(membershipLookup.getSelectCalls(), 0);
});

test('ensureProjectAccess allows project owners without membership lookup', async (t) => {
  const membershipLookup = mockMembershipLookup(t, []);

  const result = await ensureProjectAccess(buildProjectsService(project), {
    projectId: project.id,
    actor: ownerActor
  });

  assert.deepEqual(result, project);
  assert.equal(membershipLookup.getSelectCalls(), 0);
});

test('ensureProjectAccess allows admins without membership lookup', async (t) => {
  const membershipLookup = mockMembershipLookup(t, []);

  const result = await ensureProjectAccess(buildProjectsService(project), {
    projectId: project.id,
    actor: adminActor
  });

  assert.deepEqual(result, project);
  assert.equal(membershipLookup.getSelectCalls(), 0);
});

test('ensureProjectAccess allows project members when a membership row exists', async (t) => {
  const membershipLookup = mockMembershipLookup(t, [{ role: 'viewer' }]);

  const result = await ensureProjectAccess(buildProjectsService(project), {
    projectId: project.id,
    actor: memberActor
  });

  assert.deepEqual(result, project);
  assert.equal(membershipLookup.getSelectCalls(), 1);
});

test('ensureProjectAccess rejects non-owner users without project membership', async (t) => {
  const membershipLookup = mockMembershipLookup(t, []);

  await assert.rejects(
    ensureProjectAccess(buildProjectsService(project), {
      projectId: project.id,
      actor: memberActor
    }),
    ForbiddenProjectAccessError
  );

  assert.equal(membershipLookup.getSelectCalls(), 1);
});
