import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { BackgroundScheduler } = await import('./background-scheduler.js');
const { createConfiguredBackgroundScheduler } = await import('./configured-background-scheduler.factory.js');

test('createConfiguredBackgroundScheduler returns the configured background scheduler implementation', () => {
  const scheduler = createConfiguredBackgroundScheduler({
    stateService: {
      async pruneLogsByRetentionWindow() {},
      async archiveEligibleDeploymentLogs() { return 0; },
      async uploadPendingArchives() { return 0; },
      async cleanupArchivedArtifacts() { return 0; },
      async recoverStuckDeployments() { return 0; }
    } as never,
    createHeartbeatRedis: () =>
      ({
        async set() {},
        async del() {},
        async quit() {}
      }) as never
  });

  assert.ok(scheduler instanceof BackgroundScheduler);
});
