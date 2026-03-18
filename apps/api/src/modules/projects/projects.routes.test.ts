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
const { projectsRoutes } = await import('./projects.routes.js');
const { ProjectsService } = await import('./projects.service.js');

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

async function withProjectsRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
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
    scopes: ['projects:read']
  }]);

  t.mock.method(ProjectsService.prototype, 'getProjectById', async () => project);
  t.mock.method(db as { select: (fields: Record<string, unknown>) => unknown }, 'select', (fields: Record<string, unknown>) => {
    if (Object.prototype.hasOwnProperty.call(fields, 'userId')) {
      return buildSelectResult([]);
    }

    return buildSelectResult(options.membershipRows);
  });

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(projectsRoutes, { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('get project by id allows project members with projects:read scope', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-token-123',
    actorUserId: memberUserId,
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: 'Bearer member-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: project });
  });
});

test('get project by id rejects non-members who are not the owner or admin', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'outsider-token-123',
    actorUserId: outsiderUserId,
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: 'Bearer outsider-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});
