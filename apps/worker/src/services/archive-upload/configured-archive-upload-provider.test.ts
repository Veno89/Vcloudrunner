import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { ConfiguredArchiveUploadProvider } = await import('./configured-archive-upload-provider.js');

class MockArchiveUploadProvider {
  calls: Array<{ fileName: string; baseUrl: string; payload: Buffer }> = [];

  constructor(private readonly label: string) {}

  async createUploadRequest(input: { fileName: string; baseUrl: string; payload: Buffer }) {
    this.calls.push(input);
    return {
      targetUrl: `${input.baseUrl}/${this.label}/${input.fileName}`,
      headers: { provider: this.label }
    };
  }
}

test('ConfiguredArchiveUploadProvider delegates to the provider matching the configured env value', async () => {
  const originalProvider = env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'azure';

  const http = new MockArchiveUploadProvider('http');
  const s3 = new MockArchiveUploadProvider('s3');
  const gcs = new MockArchiveUploadProvider('gcs');
  const azure = new MockArchiveUploadProvider('azure');

  const provider = new ConfiguredArchiveUploadProvider({
    http,
    s3,
    gcs,
    azure
  });

  try {
    const request = await provider.createUploadRequest({
      fileName: 'deployment.ndjson.gz',
      baseUrl: 'https://uploads.example.com',
      payload: Buffer.from('payload')
    });

    assert.equal(request.headers.provider, 'azure');
    assert.equal(http.calls.length, 0);
    assert.equal(s3.calls.length, 0);
    assert.equal(gcs.calls.length, 0);
    assert.equal(azure.calls.length, 1);
  } finally {
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = originalProvider;
  }
});
