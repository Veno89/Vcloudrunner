import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { AzureArchiveUploadProvider } = await import('./azure-archive-upload-provider.js');
const { GcsArchiveUploadProvider } = await import('./gcs-archive-upload-provider.js');
const { HttpArchiveUploadProvider } = await import('./http-archive-upload-provider.js');
const { S3ArchiveUploadProvider } = await import('./s3-archive-upload-provider.js');
const { createArchiveUploadProviders } = await import('./archive-upload-provider.registry.js');

test('createArchiveUploadProviders returns the provider-specific upload adapters', () => {
  const providers = createArchiveUploadProviders();

  assert.ok(providers.http instanceof HttpArchiveUploadProvider);
  assert.ok(providers.s3 instanceof S3ArchiveUploadProvider);
  assert.ok(providers.gcs instanceof GcsArchiveUploadProvider);
  assert.ok(providers.azure instanceof AzureArchiveUploadProvider);
});
