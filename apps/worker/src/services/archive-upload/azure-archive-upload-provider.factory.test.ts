import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { AzureArchiveUploadProvider } = await import('./azure-archive-upload-provider.js');
const { createAzureArchiveUploadProvider } = await import('./azure-archive-upload-provider.factory.js');

test('createAzureArchiveUploadProvider returns the Azure archive upload provider implementation', () => {
  const provider = createAzureArchiveUploadProvider();

  assert.ok(provider instanceof AzureArchiveUploadProvider);
});
