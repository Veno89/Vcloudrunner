import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { authContextPlugin, requireAuthContext } from '../plugins/auth-context.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import {
  DomainError,
  ProjectNotFoundError,
  DeploymentNotFoundError,
  ProjectSlugTakenError,
  DeploymentCancellationNotAllowedError,
  DeploymentAlreadyActiveError,
  DeploymentQueueUnavailableError,
  ApiTokenNotFoundError
} from './domain-errors.js';

function buildTestApp() {
  const app = Fastify({ logger: false });
  app.register(errorHandlerPlugin);
  return app;
}

type DbAuthRow = {
  userId: string;
  role: 'admin' | 'user';
  scopes: unknown;
};

async function buildSiblingPluginTestApp(
  t: TestContext,
  routePlugin: FastifyPluginAsync,
  options?: {
    enableDevAuth?: boolean;
    apiTokensJson?: string;
    dbRows?: DbAuthRow[];
  }
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;
  const rows = options?.dbRows ?? [];

  env.ENABLE_DEV_AUTH = options?.enableDevAuth ?? false;
  env.API_TOKENS_JSON = options?.apiTokensJson ?? '';

  t.mock.method(db as { select: (...args: unknown[]) => unknown }, 'select', () => ({
    from() {
      return {
        where() {
          return {
            limit: async () => rows
          };
        }
      };
    }
  }));

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(routePlugin);

  await app.ready();
  return app;
}

test('error handler maps ProjectNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ProjectNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PROJECT_NOT_FOUND');
});

test('error handler maps DeploymentNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_NOT_FOUND');
});

test('error handler maps ProjectSlugTakenError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ProjectSlugTakenError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'PROJECT_SLUG_TAKEN');
});

test('error handler maps DeploymentAlreadyActiveError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentAlreadyActiveError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_ALREADY_ACTIVE');
});


test('error handler maps DeploymentQueueUnavailableError to 503', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentQueueUnavailableError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 503);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'DEPLOYMENT_QUEUE_UNAVAILABLE');
});

test('error handler maps DeploymentCancellationNotAllowedError to 409', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DeploymentCancellationNotAllowedError('running');
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 409);
});

test('error handler maps ApiTokenNotFoundError to 404', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new ApiTokenNotFoundError();
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 404);
});

test('error handler maps unknown DomainError to its statusCode', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new DomainError('CUSTOM_CODE', 'Custom failure', 422);
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 422);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'CUSTOM_CODE');
  assert.equal(body.message, 'Custom failure');
});

test('error handler returns 500 for non-domain errors', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    throw new Error('unexpected kaboom');
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 500);
});

test('error handler preserves explicit operational status codes on non-domain errors', async () => {
  const app = buildTestApp();
  app.get('/test', async () => {
    const error = new Error('Rate limit exceeded, retry in 1 minute') as Error & { statusCode?: number };
    error.statusCode = 429;
    throw error;
  });

  const res = await app.inject({ method: 'GET', url: '/test' });
  assert.equal(res.statusCode, 429);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(body.message, 'Rate limit exceeded, retry in 1 minute');
  assert.ok(body.requestId);
});

test('unknown route returns 404 JSON', async () => {
  const app = buildTestApp();

  const res = await app.inject({ method: 'GET', url: '/v1/does-not-exist' });
  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'NOT_FOUND');
});

test('root auth plugin applies to sibling route plugins', async (t) => {
  const app = await buildSiblingPluginTestApp(t, async (routeApp: FastifyInstance) => {
    routeApp.get('/v1/protected', async (request) => requireAuthContext(request));
  }, {
    apiTokensJson: JSON.stringify([{
      token: 'static-token-123',
      userId: '00000000-0000-0000-0000-000000000010',
      role: 'user',
      scopes: ['projects:read']
    }])
  });

  const res = await app.inject({
    method: 'GET',
    url: '/v1/protected',
    headers: {
      authorization: 'Bearer static-token-123'
    }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    userId: '00000000-0000-0000-0000-000000000010',
    role: 'user',
    scopes: ['projects:read']
  });
});

test('root error handler applies to sibling route plugins', async (t) => {
  const app = await buildSiblingPluginTestApp(t, async (routeApp: FastifyInstance) => {
    routeApp.get('/v1/projects/missing', async () => {
      throw new ProjectNotFoundError();
    });
  });

  const res = await app.inject({ method: 'GET', url: '/v1/projects/missing' });

  assert.equal(res.statusCode, 404);
  assert.deepEqual(JSON.parse(res.body).code, 'PROJECT_NOT_FOUND');
});
