import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createDeploymentLogArchiveBuilder } = await import('./deployment-log-archive-builder.factory.js');
const { GzipNdjsonDeploymentLogArchiveBuilder } = await import('./gzip-ndjson-deployment-log-archive-builder.js');

test('createDeploymentLogArchiveBuilder returns the configured archive builder implementation', () => {
  const builder = createDeploymentLogArchiveBuilder();

  assert.ok(builder instanceof GzipNdjsonDeploymentLogArchiveBuilder);
});
