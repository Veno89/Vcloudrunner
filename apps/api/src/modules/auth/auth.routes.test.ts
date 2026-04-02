import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../../config/env.js');
const { authContextPlugin } = await import('../../plugins/auth-context.js');
const { errorHandlerPlugin } = await import('../../plugins/error-handler.js');
const { createAuthRoutes } = await import('./auth.routes.js');

import type { AuthSessionResult } from './auth.service.js';

type AuthTestScope = 'projects:read' | 'deployments:read' | '*';

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

async function withAuthRoutesApp(
  t: TestContext,
  options: {
    enableDevAuth?: boolean;
    apiTokensJson?: string;
    getViewer?: (actor: {
      userId: string;
      role: 'admin' | 'user';
      scopes: AuthTestScope[];
      authSource: 'database-token' | 'bootstrap-token' | 'dev-user-header' | 'dev-admin-token';
    }) => Promise<{
      userId: string;
      role: 'admin' | 'user';
      scopes: AuthTestScope[];
      authSource: 'database-token' | 'bootstrap-token' | 'dev-user-header' | 'dev-admin-token';
      authMode: 'token' | 'development';
      user: {
        id: string;
        name: string;
        email: string;
      } | null;
    }>;
    upsertViewerProfile?: (
      actor: {
        userId: string;
        role: 'admin' | 'user';
        scopes: AuthTestScope[];
        authSource: 'database-token' | 'bootstrap-token' | 'dev-user-header' | 'dev-admin-token';
      },
      input: {
        name: string;
        email: string;
      }
    ) => Promise<{
      userId: string;
      role: 'admin' | 'user';
      scopes: AuthTestScope[];
      authSource: 'database-token' | 'bootstrap-token' | 'dev-user-header' | 'dev-admin-token';
      authMode: 'token' | 'development';
      user: {
        id: string;
        name: string;
        email: string;
      } | null;
    }>;
    register?: (input: { name: string; email: string; password: string }) => Promise<AuthSessionResult>;
    login?: (input: { email: string; password: string }) => Promise<AuthSessionResult>;
    changePassword?: (actor: unknown, input: { currentPassword: string; newPassword: string }) => Promise<void>;
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;

  env.ENABLE_DEV_AUTH = options.enableDevAuth ?? false;
  env.API_TOKENS_JSON = options.apiTokensJson ?? '';

  const mockDbClient = {
    select: () => buildSelectResult([])
  } as any;

  t.mock.method(mockDbClient, 'select', () => buildSelectResult([]));

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: mockDbClient });
  app.register(createAuthRoutes({
    getViewer: options.getViewer ?? (async (actor) => ({
      ...actor,
      authMode: actor.authSource === 'database-token' || actor.authSource === 'bootstrap-token'
        ? 'token'
        : 'development',
      user: null
    })),
    upsertViewerProfile: options.upsertViewerProfile ?? (async (actor, input) => ({
      ...actor,
      authMode: actor.authSource === 'database-token' || actor.authSource === 'bootstrap-token'
        ? 'token'
        : 'development',
      user: {
        id: actor.userId,
        name: input.name,
        email: input.email
      }
    })),
    register: options.register ?? (async (): Promise<never> => { throw new Error('not implemented in test'); }),
    login: options.login ?? (async (): Promise<never> => { throw new Error('not implemented in test'); }),
    changePassword: options.changePassword ?? (async () => { throw new Error('not implemented in test'); })
  }), { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('auth me returns the authenticated actor without requiring extra scopes', async (t) => {
  await withAuthRoutesApp(t, {
    apiTokensJson: JSON.stringify([{
      token: 'viewer-token-123',
      userId: '00000000-0000-0000-0000-000000000010',
      role: 'user',
      scopes: ['projects:read', 'deployments:read']
    }]),
    getViewer: async (actor) => ({
      ...actor,
      authMode: 'token',
      user: {
        id: actor.userId,
        name: 'Viewer User',
        email: 'viewer@example.com'
      }
    })
  }, async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        authorization: 'Bearer viewer-token-123'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      data: {
        userId: '00000000-0000-0000-0000-000000000010',
        role: 'user',
        scopes: ['projects:read', 'deployments:read'],
        authSource: 'bootstrap-token',
        authMode: 'token',
        user: {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'Viewer User',
          email: 'viewer@example.com'
        }
      }
    });
  });
});

test('auth me supports the explicit v1 dev-auth fallback user header', async (t) => {
  await withAuthRoutesApp(t, {
    enableDevAuth: true
  }, async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-user-id': '00000000-0000-0000-0000-000000000099'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      data: {
        userId: '00000000-0000-0000-0000-000000000099',
        role: 'admin',
        scopes: ['*'],
        authSource: 'dev-user-header',
        authMode: 'development',
        user: null
      }
    });
  });
});

test('auth me profile upsert creates or refreshes the persisted viewer profile', async (t) => {
  await withAuthRoutesApp(t, {
    apiTokensJson: JSON.stringify([{
      token: 'viewer-token-123',
      userId: '00000000-0000-0000-0000-000000000010',
      role: 'user',
      scopes: ['projects:read']
    }])
  }, async (app) => {
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/auth/me/profile',
      headers: {
        authorization: 'Bearer viewer-token-123'
      },
      payload: {
        name: 'Viewer User',
        email: 'viewer@example.com'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      data: {
        userId: '00000000-0000-0000-0000-000000000010',
        role: 'user',
        scopes: ['projects:read'],
        authSource: 'bootstrap-token',
        authMode: 'token',
        user: {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'Viewer User',
          email: 'viewer@example.com'
        }
      }
    });
  });
});

test('auth me rejects requests without an authenticated actor', async (t) => {
  await withAuthRoutesApp(t, {}, async (app) => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/me'
    });

    assert.equal(response.statusCode, 401);
    assert.equal(JSON.parse(response.body).code, 'UNAUTHORIZED');
  });
});
