import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { GcsArchiveUploadProvider } = await import('./gcs-archive-upload-provider.js');
const { createGcsArchiveUploadProvider } = await import('./gcs-archive-upload-provider.factory.js');

test('createGcsArchiveUploadProvider returns the GCS archive upload provider implementation', () => {
  const provider = createGcsArchiveUploadProvider();

  assert.ok(provider instanceof GcsArchiveUploadProvider);
});
