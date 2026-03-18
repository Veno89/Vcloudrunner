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
const { apiTokensRoutes } = await import('./api-tokens.routes.js');
const { ApiTokensService } = await import('./api-tokens.service.js');

const targetUserId = '00000000-0000-0000-0000-000000000010';
const otherUserId = '00000000-0000-0000-0000-000000000020';
const adminUserId = '00000000-0000-0000-0000-000000000030';
const tokenId = '50000000-0000-0000-0000-000000000001';

const listedTokenRecord = {
  id: tokenId,
  userId: targetUserId,
  role: 'user' as const,
  scopes: ['projects:read'],
  label: 'CLI token',
  expiresAt: null,
  revokedAt: null,
  createdAt: '2026-03-18T15:00:00.000Z',
  updatedAt: '2026-03-18T15:00:00.000Z',
  tokenLast4: 'abcd'
};

const createdToken = {
  token: 'plain-secret-token',
  record: {
    id: '50000000-0000-0000-0000-000000000002',
    userId: targetUserId,
    role: 'user' as const,
    scopes: ['projects:read', 'tokens:read'],
    label: 'Dashboard token',
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-03-18T16:00:00.000Z',
    updatedAt: '2026-03-18T16:00:00.000Z'
  }
};

const revokedToken = {
  id: tokenId,
  revokedAt: '2026-03-18T17:00:00.000Z',
  updatedAt: '2026-03-18T17:00:00.000Z'
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

async function withApiTokensRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
    role?: 'admin' | 'user';
    scopes: string[];
    listForUserImplementation?: typeof ApiTokensService.prototype.listForUser;
    createForUserImplementation?: typeof ApiTokensService.prototype.createForUser;
    rotateForUserImplementation?: typeof ApiTokensService.prototype.rotateForUser;
    revokeForUserImplementation?: typeof ApiTokensService.prototype.revokeForUser;
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;

  env.ENABLE_DEV_AUTH = false;
  env.API_TOKENS_JSON = JSON.stringify([{
    token: options.token,
    userId: options.actorUserId,
    role: options.role ?? 'user',
    scopes: options.scopes
  }]);

  t.mock.method(
    db as { select: (fields: Record<string, unknown>) => unknown },
    'select',
    () => buildSelectResult([])
  );
  t.mock.method(
    ApiTokensService.prototype,
    'listForUser',
    options.listForUserImplementation ?? (async () => [listedTokenRecord])
  );
  t.mock.method(
    ApiTokensService.prototype,
    'createForUser',
    options.createForUserImplementation ?? (async () => createdToken)
  );
  t.mock.method(
    ApiTokensService.prototype,
    'rotateForUser',
    options.rotateForUserImplementation ?? (async () => createdToken)
  );
  t.mock.method(
    ApiTokensService.prototype,
    'revokeForUser',
    options.revokeForUserImplementation ?? (async () => revokedToken)
  );

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(apiTokensRoutes, { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('list api tokens allows admin access to another user without explicit token scopes', async (t) => {
  await withApiTokensRoutesApp(t, {
    token: 'admin-token-123',
    actorUserId: adminUserId,
    role: 'admin',
    scopes: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${targetUserId}/api-tokens`,
      headers: {
        authorization: 'Bearer admin-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      data: [{
        id: listedTokenRecord.id,
        userId: listedTokenRecord.userId,
        role: listedTokenRecord.role,
        scopes: listedTokenRecord.scopes,
        label: listedTokenRecord.label,
        expiresAt: listedTokenRecord.expiresAt,
        revokedAt: listedTokenRecord.revokedAt,
        createdAt: listedTokenRecord.createdAt,
        updatedAt: listedTokenRecord.updatedAt,
        tokenPreview: '****...abcd'
      }]
    });
  });
});

test('list api tokens rejects non-admin access to another user resource', async (t) => {
  await withApiTokensRoutesApp(t, {
    token: 'user-read-token-123',
    actorUserId: otherUserId,
    scopes: ['tokens:read']
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${targetUserId}/api-tokens`,
      headers: {
        authorization: 'Bearer user-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_USER_ACCESS');
  });
});

test('create api token rejects tokens missing tokens:write scope', async (t) => {
  await withApiTokensRoutesApp(t, {
    token: 'user-no-write-token-123',
    actorUserId: targetUserId,
    scopes: ['tokens:read']
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetUserId}/api-tokens`,
      headers: {
        authorization: 'Bearer user-no-write-token-123'
      },
      payload: {
        role: 'user',
        scopes: ['projects:read'],
        label: 'CLI token'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('rotate api token maps missing token to 404', async (t) => {
  await withApiTokensRoutesApp(t, {
    token: 'user-write-token-123',
    actorUserId: targetUserId,
    scopes: ['tokens:write'],
    rotateForUserImplementation: async () => null
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${targetUserId}/api-tokens/${tokenId}/rotate`,
      headers: {
        authorization: 'Bearer user-write-token-123'
      }
    });

    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.body).code, 'API_TOKEN_NOT_FOUND');
  });
});
