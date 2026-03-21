import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { createBackgroundScheduler } = await import('./background-scheduler.factory.js');

test('createBackgroundScheduler wires the state service, heartbeat redis, and logger', () => {
  const stateService = { kind: 'state-service' };
  const logger = {
    info() {},
    warn() {},
    error() {}
  };

  class FakeRedis {
    constructor(
      public readonly url: string,
      public readonly options: {
        maxRetriesPerRequest: null;
        enableReadyCheck: false;
      }
    ) {}
  }

  class FakeScheduler {
    constructor(
      public readonly wiredStateService: unknown,
      public readonly heartbeatRedis: FakeRedis,
      public readonly wiredLogger: unknown
    ) {}
  }

  const scheduler = createBackgroundScheduler({
    stateService: stateService as never,
    logger: logger as never,
    RedisClass: FakeRedis as never,
    SchedulerClass: FakeScheduler as never
  }) as unknown as FakeScheduler;

  assert.equal(scheduler.wiredStateService, stateService);
  assert.equal(scheduler.wiredLogger, logger);
  assert.equal(scheduler.heartbeatRedis.url, env.REDIS_URL);
  assert.deepEqual(scheduler.heartbeatRedis.options, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
});
