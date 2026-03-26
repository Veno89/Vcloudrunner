import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createHttpArchiveUploadProvider } = await import('./http-archive-upload-provider.factory.js');
const { HttpArchiveUploadProvider } = await import('./http-archive-upload-provider.js');

test('createHttpArchiveUploadProvider returns the HTTP archive upload provider implementation', () => {
  const provider = createHttpArchiveUploadProvider();

  assert.ok(provider instanceof HttpArchiveUploadProvider);
});
