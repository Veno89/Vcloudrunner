import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { ConfiguredArchiveUploadProvider } = await import('./configured-archive-upload-provider.js');

class MockArchiveUploadProvider {
  calls: Array<{ fileName: string; baseUrl: string; payload: Buffer }> = [];
  nativeCalls: Array<{
    request: {
      provider: 's3' | 'azure';
      transport: 'native';
      targetUrl: string;
      headers: Record<string, string>;
    };
    payload: Buffer;
    signal: AbortSignal;
  }> = [];

  constructor(private readonly label: string) {}

  async createUploadRequest(input: {
    fileName: string;
    baseUrl: string;
    payload: Buffer;
  }): Promise<{
    provider: 'http';
    transport: 'http';
    targetUrl: string;
    headers: { provider: string };
  }> {
    this.calls.push(input);
    return {
      provider: 'http',
      transport: 'http',
      targetUrl: `${input.baseUrl}/${this.label}/${input.fileName}`,
      headers: { provider: this.label }
    };
  }

  async uploadNative(input: {
    request: {
      provider: 's3' | 'azure';
      transport: 'native';
      targetUrl: string;
      headers: Record<string, string>;
    };
    payload: Buffer;
    signal: AbortSignal;
  }) {
    this.nativeCalls.push(input);
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

test('ConfiguredArchiveUploadProvider delegates native uploads using the request provider key', async () => {
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

  await provider.uploadNative?.({
    request: {
      provider: 's3',
      transport: 'native',
      targetUrl: 'https://uploads.example.com/my-bucket/archive.ndjson.gz',
      headers: { 'content-type': 'application/gzip' },
      bucket: 'my-bucket',
      key: 'archive.ndjson.gz',
      endpoint: 'https://uploads.example.com'
    },
    payload: Buffer.from('payload'),
    signal: new AbortController().signal
  });

  assert.equal(s3.nativeCalls.length, 1);
  assert.equal(azure.nativeCalls.length, 0);
});
