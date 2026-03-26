import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const {
  createConfiguredDeploymentLogArchiveBuilder
} = await import('./configured-deployment-log-archive-builder.factory.js');
const { GzipNdjsonDeploymentLogArchiveBuilder } = await import('./gzip-ndjson-deployment-log-archive-builder.js');

test('createConfiguredDeploymentLogArchiveBuilder returns the configured archive builder implementation', () => {
  const builder = createConfiguredDeploymentLogArchiveBuilder();

  assert.ok(builder instanceof GzipNdjsonDeploymentLogArchiveBuilder);
});

test('createConfiguredDeploymentLogArchiveBuilder supports overriding the archive builder implementation', () => {
  class FakeArchiveBuilder {
    buildArchive() {
      return Buffer.from('fake');
    }
  }

  const builder = createConfiguredDeploymentLogArchiveBuilder({
    BuilderClass: FakeArchiveBuilder as never
  });

  assert.ok(builder instanceof FakeArchiveBuilder);
});
