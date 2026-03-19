import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';

const { parseRedisConnectionOptions } = await import('./redis.js');

test('parseRedisConnectionOptions parses credentials and explicit database index', () => {
  const options = parseRedisConnectionOptions('redis://user:pass@cache.internal:6381/5');

  assert.deepEqual(options, {
    host: 'cache.internal',
    port: 6381,
    username: 'user',
    password: 'pass',
    db: 5,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
});

test('parseRedisConnectionOptions defaults to port 6379 and database 0', () => {
  const options = parseRedisConnectionOptions('redis://cache.internal');

  assert.deepEqual(options, {
    host: 'cache.internal',
    port: 6379,
    username: undefined,
    password: undefined,
    db: 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
});

test('parseRedisConnectionOptions rejects non-integer database index paths', () => {
  assert.throws(
    () => parseRedisConnectionOptions('redis://cache.internal/not-a-db'),
    /REDIS_URL path must be empty or a single integer database index/
  );
});

test('parseRedisConnectionOptions rejects nested database index paths', () => {
  assert.throws(
    () => parseRedisConnectionOptions('redis://cache.internal/0/extra'),
    /REDIS_URL path must be empty or a single integer database index/
  );
});
