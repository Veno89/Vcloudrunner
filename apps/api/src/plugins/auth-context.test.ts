import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../config/env.js');
const { authContextPlugin, requireAuthContext } = await import('./auth-context.js');
const { errorHandlerPlugin } = await import('./error-handler.js');

const DEFAULT_DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const STATIC_USER_ID = '00000000-0000-0000-0000-000000000010';
const DB_USER_ID = '00000000-0000-0000-0000-000000000020';
const HEADER_USER_ID = '00000000-0000-0000-0000-000000000030';
const EXTERNAL_ROUTE_USER_ID = '00000000-0000-0000-0000-000000000040';

type DbAuthRow = {
  userId: string;
  role: 'admin' | 'user';
  scopes: unknown;
};

async function withTestApp(
  t: TestContext,
  options: {
    enableDevAuth?: boolean;
    apiTokensJson?: string;
    dbRows?: DbAuthRow[];
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;
  const rows = options.dbRows ?? [];

  env.ENABLE_DEV_AUTH = options.enableDevAuth ?? false;
  env.API_TOKENS_JSON = options.apiTokensJson ?? '';

  const mockDbClient = {
    select: () => ({
      from() {
        return {
          where() {
            return {
              limit: async () => rows
            };
          }
        };
      }
    })
  } as any;

  t.mock.method(mockDbClient, 'select', mockDbClient.select);

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: mockDbClient });

  app.get('/v1/required', async (request) => requireAuthContext(request));
  app.get('/internal/required', async (request) => requireAuthContext(request));

  await app.ready();
  await run(app);
}

test('auth context falls back to static tokens when the DB lookup misses', async (t) => {
  await withTestApp(t, {
    apiTokensJson: JSON.stringify([{
      token: 'static-token-123',
      userId: STATIC_USER_ID,
      role: 'user',
      scopes: ['projects:read']
    }])
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Bearer static-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      userId: STATIC_USER_ID,
      role: 'user',
      scopes: ['projects:read']
    });
  });
});

test('auth context prefers DB-backed tokens over static token fallback for the same bearer token', async (t) => {
  await withTestApp(t, {
    apiTokensJson: JSON.stringify([{
      token: 'shared-token-123',
      userId: STATIC_USER_ID,
      role: 'user',
      scopes: ['projects:read']
    }]),
    dbRows: [{
      userId: DB_USER_ID,
      role: 'admin',
      scopes: []
    }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Bearer shared-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      userId: DB_USER_ID,
      role: 'admin',
      scopes: ['*']
    });
  });
});

test('auth context accepts dev-admin-token only when explicit dev auth is enabled', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Bearer dev-admin-token'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      userId: DEFAULT_DEV_USER_ID,
      role: 'admin',
      scopes: ['*']
    });
  });
});

test('auth context rejects dev-admin-token when explicit dev auth is disabled', async (t) => {
  await withTestApp(t, {}, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Bearer dev-admin-token'
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
  });
});

test('auth context does not fall back to dev auth when a bearer token is provided but invalid', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Bearer definitely-not-valid'
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
  });
});

test('auth context does not fall back to dev auth when the authorization header is malformed', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        authorization: 'Basic totally-wrong',
        'x-user-id': HEADER_USER_ID
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
  });
});

test('auth context uses x-user-id only for v1 requests when explicit dev auth is enabled', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/required',
      headers: {
        'x-user-id': HEADER_USER_ID
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      userId: HEADER_USER_ID,
      role: 'admin',
      scopes: ['*']
    });
  });
});

test('requireAuthContext preserves the explicit dev-auth fallback for non-v1 routes', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/required',
      headers: {
        'x-user-id': EXTERNAL_ROUTE_USER_ID
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      userId: EXTERNAL_ROUTE_USER_ID,
      role: 'admin',
      scopes: ['*']
    });
  });
});

test('requireAuthContext does not fall back to dev auth on non-v1 routes when an auth header was provided', async (t) => {
  await withTestApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/required',
      headers: {
        authorization: 'Bearer definitely-not-valid',
        'x-user-id': EXTERNAL_ROUTE_USER_ID
      }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
  });
});

test('auth context plugin rejects malformed API_TOKENS_JSON with an explicit startup error', async (t) => {
  const originalApiTokensJson = env.API_TOKENS_JSON;
  env.API_TOKENS_JSON = '[{"token":';

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: {} as any });

  await assert.rejects(
    async () => {
      await app.ready();
    },
    /Invalid API_TOKENS_JSON: expected a valid JSON array of token entries/
  );
});

test('auth context plugin rejects duplicate static token entries at startup', async (t) => {
  const originalApiTokensJson = env.API_TOKENS_JSON;
  env.API_TOKENS_JSON = JSON.stringify([
    {
      token: 'duplicate-token-123',
      userId: STATIC_USER_ID,
      role: 'user',
      scopes: ['projects:read']
    },
    {
      token: 'duplicate-token-123',
      userId: DB_USER_ID,
      role: 'admin'
    }
  ]);

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: {} as any });

  await assert.rejects(
    async () => {
      await app.ready();
    },
    /Invalid API_TOKENS_JSON: Duplicate static token entry/
  );
});
