import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const {
  createConfiguredDeploymentLogArchiveStore
} = await import('./configured-deployment-log-archive-store.factory.js');
const { LocalDeploymentLogArchiveStore } = await import('./local-deployment-log-archive-store.js');

test('createConfiguredDeploymentLogArchiveStore returns the configured archive store implementation', () => {
  const store = createConfiguredDeploymentLogArchiveStore();

  assert.ok(store instanceof LocalDeploymentLogArchiveStore);
});

test('createConfiguredDeploymentLogArchiveStore wires the configured archive directory', () => {
  class FakeArchiveStore {
    constructor(public readonly archiveDir: string) {}
  }

  const store = createConfiguredDeploymentLogArchiveStore({
    StoreClass: FakeArchiveStore as never
  }) as unknown as FakeArchiveStore;

  assert.equal(store.archiveDir, env.DEPLOYMENT_LOG_ARCHIVE_DIR);
});
