import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

const { env } = await import('../../config/env.js');
const { db } = await import('../../db/client.js');
const { authContextPlugin } = await import('../../plugins/auth-context.js');
const { errorHandlerPlugin } = await import('../../plugins/error-handler.js');
const { environmentRoutes } = await import('./environment.routes.js');
const { ProjectsService } = await import('../projects/projects.service.js');
const { EnvironmentService } = await import('./environment.service.js');

const ownerUserId = '00000000-0000-0000-0000-000000000010';
const memberUserId = '00000000-0000-0000-0000-000000000020';
const outsiderUserId = '00000000-0000-0000-0000-000000000030';
const projectId = '10000000-0000-0000-0000-000000000001';

const project = {
  id: projectId,
  userId: ownerUserId,
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

const environmentVariable = {
  id: '30000000-0000-0000-0000-000000000001',
  key: 'API_KEY',
  value: 'secret-value',
  updatedAt: '2026-03-18T15:00:00.000Z'
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

async function withEnvironmentRoutesApp(
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
  t.mock.method(EnvironmentService.prototype, 'list', async () => [environmentVariable]);
  t.mock.method(EnvironmentService.prototype, 'upsert', async () => environmentVariable);
  t.mock.method(EnvironmentService.prototype, 'remove', async () => true);

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(environmentRoutes, { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('list environment variables allows project members with environment:read scope', async (t) => {
  await withEnvironmentRoutesApp(t, {
    token: 'member-env-read-token-123',
    actorUserId: memberUserId,
    scopes: ['environment:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/environment-variables`,
      headers: {
        authorization: 'Bearer member-env-read-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: [environmentVariable] });
  });
});

test('upsert environment variable allows project members with environment:write scope', async (t) => {
  await withEnvironmentRoutesApp(t, {
    token: 'member-env-write-token-123',
    actorUserId: memberUserId,
    scopes: ['environment:write'],
    membershipRows: [{ role: 'editor' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/environment-variables`,
      headers: {
        authorization: 'Bearer member-env-write-token-123'
      },
      payload: {
        key: 'API_KEY',
        value: 'secret-value'
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), { data: environmentVariable });
  });
});

test('delete environment variable rejects tokens missing environment:write scope', async (t) => {
  await withEnvironmentRoutesApp(t, {
    token: 'member-env-no-write-token-123',
    actorUserId: memberUserId,
    scopes: ['environment:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/environment-variables/API_KEY`,
      headers: {
        authorization: 'Bearer member-env-no-write-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('list environment variables rejects non-members who are not the owner or admin', async (t) => {
  await withEnvironmentRoutesApp(t, {
    token: 'outsider-env-read-token-123',
    actorUserId: outsiderUserId,
    scopes: ['environment:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/environment-variables`,
      headers: {
        authorization: 'Bearer outsider-env-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});
