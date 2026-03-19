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
const { logsRoutes } = await import('./logs.routes.js');
const { ProjectsService } = await import('../projects/projects.service.js');
const { LogsService } = await import('./logs.service.js');

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

const logEntry = {
  id: '40000000-0000-0000-0000-000000000001',
  deploymentId,
  level: 'info',
  message: 'Deployment started',
  timestamp: new Date('2026-03-18T15:00:00.000Z')
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

async function withLogsRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
    scopes: string[];
    membershipRows: Array<{ role: string }>;
    listImplementation?: typeof LogsService.prototype.list;
    exportImplementation?: typeof LogsService.prototype.export;
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
  t.mock.method(
    LogsService.prototype,
    'list',
    options.listImplementation ?? (async () => [logEntry])
  );
  t.mock.method(
    LogsService.prototype,
    'export',
    options.exportImplementation ?? (async () => [logEntry])
  );

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(logsRoutes, { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('list deployment logs allows project members with logs:read scope', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'member-logs-read-token-123',
    actorUserId: memberUserId,
    scopes: ['logs:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs?limit=20`,
      headers: {
        authorization: 'Bearer member-logs-read-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      data: [{
        ...logEntry,
        timestamp: logEntry.timestamp.toISOString()
      }]
    });
  });
});

test('export deployment logs allows project members with logs:read scope', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'member-logs-export-token-123',
    actorUserId: memberUserId,
    scopes: ['logs:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs/export`,
      headers: {
        authorization: 'Bearer member-logs-export-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /application\/x-ndjson/);
    assert.match(String(res.headers['content-disposition']), /deployment-.*-logs\.ndjson/);
    assert.match(res.body, /"message":"Deployment started"/);
  });
});

test('list deployment logs rejects tokens missing logs:read scope', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'member-logs-no-read-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs`,
      headers: {
        authorization: 'Bearer member-logs-no-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('list deployment logs rejects non-members who are not the owner or admin', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'outsider-logs-read-token-123',
    actorUserId: outsiderUserId,
    scopes: ['logs:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs`,
      headers: {
        authorization: 'Bearer outsider-logs-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});

test('stream deployment logs rejects tokens missing logs:read scope', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'member-logs-stream-no-read-token-123',
    actorUserId: memberUserId,
    scopes: ['deployments:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs/stream`,
      headers: {
        authorization: 'Bearer member-logs-stream-no-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('stream deployment logs rejects non-members who are not the owner or admin', async (t) => {
  await withLogsRoutesApp(t, {
    token: 'outsider-logs-stream-token-123',
    actorUserId: outsiderUserId,
    scopes: ['logs:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs/stream`,
      headers: {
        authorization: 'Bearer outsider-logs-stream-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});

test('stream emits an SSE error event and closes cleanly when polling fails after the initial payload', async (t) => {
  let listCalls = 0;

  t.mock.method(globalThis, 'setInterval', (handler: TimerHandler) => {
    if (typeof handler === 'function') {
      handler();
    }
    return 1 as unknown as ReturnType<typeof setInterval>;
  });
  t.mock.method(globalThis, 'clearInterval', () => undefined);

  await withLogsRoutesApp(t, {
    token: 'member-logs-stream-token-123',
    actorUserId: memberUserId,
    scopes: ['logs:read'],
    membershipRows: [{ role: 'viewer' }],
    listImplementation: async () => {
      listCalls += 1;

      if (listCalls === 1) {
        return [logEntry];
      }

      throw new Error('database unavailable');
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/deployments/${deploymentId}/logs/stream?pollMs=1000`,
      headers: {
        authorization: 'Bearer member-logs-stream-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /text\/event-stream/);
    assert.match(res.body, /"message":"Deployment started"/);
    assert.match(res.body, /event: error/);
    assert.match(res.body, /Live log streaming temporarily unavailable/);
  });
});
