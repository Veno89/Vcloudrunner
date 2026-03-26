import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { createBackgroundScheduler } = await import('./background-scheduler.factory.js');

test('createBackgroundScheduler wires the state service, heartbeat redis, and logger', () => {
  const stateService = { kind: 'state-service' };
  const logger = {
    info() {},
    warn() {},
    error() {}
  };

  const heartbeatRedis = { kind: 'heartbeat-redis' };

  class FakeScheduler {
    constructor(
      public readonly wiredStateService: unknown,
      public readonly heartbeatRedis: unknown,
      public readonly wiredLogger: unknown
    ) {}
  }

  const scheduler = createBackgroundScheduler({
    stateService: stateService as never,
    logger: logger as never,
    createHeartbeatRedis: () => heartbeatRedis as never,
    SchedulerClass: FakeScheduler as never
  }) as unknown as FakeScheduler;

  assert.equal(scheduler.wiredStateService, stateService);
  assert.equal(scheduler.wiredLogger, logger);
  assert.equal(scheduler.heartbeatRedis, heartbeatRedis);
});
