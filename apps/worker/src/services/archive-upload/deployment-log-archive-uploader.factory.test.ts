import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredDeploymentLogArchiveUploader } = await import('./configured-deployment-log-archive-uploader.js');
const { createDeploymentLogArchiveUploader } = await import('./deployment-log-archive-uploader.factory.js');

test('createDeploymentLogArchiveUploader returns the configured archive uploader implementation', () => {
  const uploader = createDeploymentLogArchiveUploader();

  assert.ok(uploader instanceof ConfiguredDeploymentLogArchiveUploader);
});
