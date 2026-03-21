import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredArchiveUploadProvider } = await import('./configured-archive-upload-provider.js');
const { createArchiveUploadProvider } = await import('./archive-upload-provider.factory.js');

test('createArchiveUploadProvider returns the configured archive upload provider implementation', () => {
  const provider = createArchiveUploadProvider();

  assert.ok(provider instanceof ConfiguredArchiveUploadProvider);
});
