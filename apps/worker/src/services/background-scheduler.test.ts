import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { BackgroundScheduler } = await import('./background-scheduler.js');

class MockRedis {
  delCalls: string[] = [];
  quitCalls = 0;

  async set() {
    return 'OK';
  }

  async del(key: string) {
    this.delCalls.push(key);
    return 1;
  }

  async quit() {
    this.quitCalls += 1;
    return 'OK';
  }
}

class MockStateService {
  async pruneLogsByRetentionWindow() {}
  async archiveEligibleDeploymentLogs() { return 0; }
  async uploadPendingArchives() { return 0; }
  async cleanupArchivedArtifacts() { return 0; }
  async recoverStuckDeployments() { return 0; }
}

class BlockingStateService extends MockStateService {
  pruneCalls = 0;
  private releasePrune: (() => void) | undefined;
  private readonly firstPrune = new Promise<void>((resolve) => {
    this.releasePrune = resolve;
  });

  override async pruneLogsByRetentionWindow() {
    this.pruneCalls += 1;

    if (this.pruneCalls === 1) {
      await this.firstPrune;
    }
  }

  finishFirstPrune() {
    this.releasePrune?.();
  }
}

function createClock() {
  const scheduled: Array<{ timer: object; intervalMs: number }> = [];
  const cleared: object[] = [];

  return {
    scheduled,
    cleared,
    clock: {
      setInterval(handler: () => void, intervalMs: number) {
        const timer = { handler, intervalMs };
        scheduled.push({ timer, intervalMs });
        return timer as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval(timer: ReturnType<typeof setInterval>) {
        cleared.push(timer as object);
      }
    }
  };
}

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

test('start is idempotent and schedules each background task only once', async () => {
  const redis = new MockRedis();
  const { scheduled, cleared, clock } = createClock();
  const scheduler = new BackgroundScheduler(
    new MockStateService() as never,
    redis as never,
    createLogger() as never,
    clock
  );

  scheduler.start();
  scheduler.start();

  assert.equal(scheduled.length, 6);
  assert.deepEqual(
    scheduled.map((entry) => entry.intervalMs),
    [
      env.DEPLOYMENT_LOG_PRUNE_INTERVAL_MS,
      env.DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS,
      env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS,
      env.DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS,
      env.DEPLOYMENT_STUCK_RECOVERY_INTERVAL_MS,
      env.WORKER_HEARTBEAT_INTERVAL_MS
    ]
  );

  await scheduler.stop();

  assert.equal(cleared.length, 6);
  assert.deepEqual(redis.delCalls, [env.WORKER_HEARTBEAT_KEY]);
  assert.equal(redis.quitCalls, 1);
});

test('stop clears scheduled timers so start can reschedule cleanly', async () => {
  const redis = new MockRedis();
  const { scheduled, clock } = createClock();
  const scheduler = new BackgroundScheduler(
    new MockStateService() as never,
    redis as never,
    createLogger() as never,
    clock
  );

  scheduler.start();
  await scheduler.stop();
  scheduler.start();

  assert.equal(scheduled.length, 12);
  assert.deepEqual(redis.delCalls, [env.WORKER_HEARTBEAT_KEY]);
  assert.equal(redis.quitCalls, 1);
});

test('task handlers skip overlapping interval ticks until the active run settles', async () => {
  const redis = new MockRedis();
  const stateService = new BlockingStateService();
  const { scheduled, clock } = createClock();
  const scheduler = new BackgroundScheduler(
    stateService as never,
    redis as never,
    createLogger() as never,
    clock
  );

  scheduler.start();

  const firstScheduledTask = scheduled[0]?.timer as { handler?: () => void } | undefined;
  const runPruneTask = firstScheduledTask?.handler;
  if (!runPruneTask) {
    throw new Error('expected prune task to be scheduled');
  }

  runPruneTask();
  await Promise.resolve();
  runPruneTask();
  await Promise.resolve();

  assert.equal(stateService.pruneCalls, 1);

  stateService.finishFirstPrune();
  await new Promise<void>((resolve) => setImmediate(resolve));

  runPruneTask();
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(stateService.pruneCalls, 2);

  await scheduler.stop();
});
