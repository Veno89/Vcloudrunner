import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createDeploymentLogArchiveStore } = await import('./deployment-log-archive-store.factory.js');
const { LocalDeploymentLogArchiveStore } = await import('./local-deployment-log-archive-store.js');

test('createDeploymentLogArchiveStore returns the configured archive store implementation', () => {
  const archiveStore = createDeploymentLogArchiveStore();

  assert.ok(archiveStore instanceof LocalDeploymentLogArchiveStore);
});
