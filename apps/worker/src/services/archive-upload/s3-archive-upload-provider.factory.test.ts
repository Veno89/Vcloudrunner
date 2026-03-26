import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { S3ArchiveUploadProvider } = await import('./s3-archive-upload-provider.js');
const { createS3ArchiveUploadProvider } = await import('./s3-archive-upload-provider.factory.js');

test('createS3ArchiveUploadProvider returns the S3 archive upload provider implementation', () => {
  const provider = createS3ArchiveUploadProvider();

  assert.ok(provider instanceof S3ArchiveUploadProvider);
});
