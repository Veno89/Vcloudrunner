import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { parseRedisConnectionOptions } = await import('./redis.js');
const { createConfiguredRedisConnection } = await import('./configured-redis-connection.factory.js');

test('createConfiguredRedisConnection returns the parsed configured Redis connection options', () => {
  const connection = createConfiguredRedisConnection();

  assert.deepEqual(connection, parseRedisConnectionOptions(env.REDIS_URL));
});
