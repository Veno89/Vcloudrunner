import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { createHeartbeatRedis } = await import('./heartbeat-redis.factory.js');

test('createHeartbeatRedis wires the configured Redis url and heartbeat-safe options', () => {
  class FakeRedis {
    constructor(
      public readonly url: string,
      public readonly options: {
        maxRetriesPerRequest: null;
        enableReadyCheck: false;
      }
    ) {}
  }

  const redis = createHeartbeatRedis({
    RedisClass: FakeRedis as never
  }) as unknown as FakeRedis;

  assert.equal(redis.url, env.REDIS_URL);
  assert.deepEqual(redis.options, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
});
