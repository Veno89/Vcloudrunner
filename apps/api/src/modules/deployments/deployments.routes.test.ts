import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../../config/env.js');
const { db } = await import('../../db/client.js');
const { authContextPlugin } = await import('../../plugins/auth-context.js');
const { errorHandlerPlugin } = await import('../../plugins/error-handler.js');
const { deploymentsRoutes } = await import('./deployments.routes.js');
const { ProjectsService } = await import('../projects/projects.service.js');
const { DeploymentsService } = await import('./deployments.service.js');

const ownerUserId = '00000000-0000-0000-0000-000000000010';
const memberUserId = '00000000-0000-0000-0000-000000000020';
const outsiderUserId = '00000000-0000-0000-0000-000000000030';
const projectId = '10000000-0000-0000-0000-000000000001';
const deploymentId = '20000000-0000-0000-0000-000000000001';

const project = {
  id: projectId,
  userId: ownerUserId,
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

const deploymentRecord = {
  id: deploymentId,
  projectId,
  status: 'queued' as const,
  commitSha: 'abcdef1',
  branch: 'main',
  metadata: {},
  createdAt: '2026-03-18T15:00:00.000Z',
  updatedAt: '2026-03-18T15:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  runtimeUrl: null
};

const queuedDeploymentResponse = {
  ...deploymentRecord,
  queueJobId: deploymentId
};

function buildSelectResult(rows: unknown[]) {
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
}

async function withDeploymentsRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
    scopes: string[];
    membershipRows: Array<{ role: string }>;
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;

  env.ENABLE_DEV_AUTH = false;
  env.API_TOKENS_JSON = JSON.stringify([{
    token: options.token,
    userId: options.actorUserId,
    role: 'user',
    scopes: options.scopes
  }]);

  t.mock.method(ProjectsService.prototype, 'getProjectById', async () => project);
  t.mock.method(
    db as { select: (fields: Record<string, unknown>) => unknown },
    'select',
    () => buildSelectResult(options.membershipRows)
  );
  t.mock.method(DeploymentsService.prototype, 'listDeployments', async () => [deploymentRecord]);
  t.mock.method(DeploymentsService.prototype, 'createDeployment', async () => queuedDeploymentResponse);
  t.mock.method(DeploymentsService.prototype, 'cancelDeployment', async () => ({
    deploymentId,
    status: 'queued' as const,
    cancellation: 'requested' as const
  }));

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(deploymentsRoutes, { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('list deployments allows project members with deployments:read scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-read-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer member-read-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: [deploymentRecord] });
  });
});

test('list deployments rejects tokens missing deployments:read scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-no-read-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:write'],
    membershipRows: [{ role: 'editor' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer member-no-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('create deployment allows project members with deployments:write scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-write-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:write'],
    membershipRows: [{ role: 'editor' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer member-write-token-123'
      },
      payload: {}
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), { data: queuedDeploymentResponse });
  });
});

test('create deployment rejects tokens missing deployments:write scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-no-write-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer member-no-write-token-123'
      },
      payload: {}
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('create deployment rejects non-members who are not the owner or admin', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'outsider-write-token-123',
    actorUserId: outsiderUserId,
    scopes: ['deployments:write'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer outsider-write-token-123'
      },
      payload: {}
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});

test('cancel deployment allows project members with deployments:cancel scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-cancel-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:cancel'],
    membershipRows: [{ role: 'editor' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/cancel`,
      headers: {
        authorization: 'Bearer member-cancel-token-123'
      }
    });

    assert.equal(res.statusCode, 202);
    assert.deepEqual(JSON.parse(res.body), {
      data: {
        deploymentId,
        status: 'queued',
        cancellation: 'requested'
      }
    });
  });
});

test('cancel deployment rejects tokens that are missing deployments:cancel scope', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'member-no-cancel-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/cancel`,
      headers: {
        authorization: 'Bearer member-no-cancel-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('cancel deployment rejects non-members who are not the owner or admin', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'outsider-cancel-token-123',
    actorUserId: outsiderUserId,
    scopes: ['deployments:cancel'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/cancel`,
      headers: {
        authorization: 'Bearer outsider-cancel-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});

test('list deployments rejects non-members who are not the owner or admin', async (t) => {
  await withDeploymentsRoutesApp(t, {
    token: 'outsider-read-token-123',
    actorUserId: outsiderUserId,
    scopes: ['deployments:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments`,
      headers: {
        authorization: 'Bearer outsider-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});
