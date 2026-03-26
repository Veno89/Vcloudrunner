import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { AuthService } = await import('./auth.service.js');

function createDbClientWithRows(rows: unknown[]) {
  return {
    select() {
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
  };
}

test('getViewer includes persisted user profile details when the user exists', async () => {
  const service = new AuthService(createDbClientWithRows([{
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Platform Operator',
    email: 'operator@example.com'
  }]) as never);

  const viewer = await service.getViewer({
    userId: '00000000-0000-0000-0000-000000000010',
    role: 'user',
    scopes: ['projects:read'],
    authSource: 'database-token'
  });

  assert.deepEqual(viewer, {
    userId: '00000000-0000-0000-0000-000000000010',
    role: 'user',
    scopes: ['projects:read'],
    authSource: 'database-token',
    authMode: 'token',
    user: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Platform Operator',
      email: 'operator@example.com'
    }
  });
});

test('getViewer still returns actor identity when no persisted user record is present', async () => {
  const service = new AuthService(createDbClientWithRows([]) as never);

  const viewer = await service.getViewer({
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'admin',
    scopes: ['*'],
    authSource: 'dev-user-header'
  });

  assert.deepEqual(viewer, {
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'admin',
    scopes: ['*'],
    authSource: 'dev-user-header',
    authMode: 'development',
    user: null
  });
});
