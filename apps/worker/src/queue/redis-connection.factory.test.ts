import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { parseRedisConnectionOptions } = await import('./redis.js');
const { createRedisConnection } = await import('./redis-connection.factory.js');

test('createRedisConnection returns the configured Redis connection when no override url is provided', () => {
  const connection = createRedisConnection();

  assert.deepEqual(connection, parseRedisConnectionOptions(env.REDIS_URL));
});

test('createRedisConnection parses an explicit override Redis url', () => {
  const connection = createRedisConnection({
    redisUrl: 'redis://user:pass@cache.internal:6381/5'
  });

  assert.deepEqual(connection, {
    host: 'cache.internal',
    port: 6381,
    username: 'user',
    password: 'pass',
    db: 5,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
});
