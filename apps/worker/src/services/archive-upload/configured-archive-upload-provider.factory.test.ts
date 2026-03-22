import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredArchiveUploadProvider } = await import('./configured-archive-upload-provider.js');
const { createConfiguredArchiveUploadProvider } = await import('./configured-archive-upload-provider.factory.js');

test('createConfiguredArchiveUploadProvider returns the configured archive upload provider implementation', () => {
  const provider = createConfiguredArchiveUploadProvider();

  assert.ok(provider instanceof ConfiguredArchiveUploadProvider);
});
