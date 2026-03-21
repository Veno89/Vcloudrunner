import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { ConfiguredDeploymentLogArchiveUploader } = await import('./configured-deployment-log-archive-uploader.js');

const envSnapshot = {
  maxAttempts: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS,
  timeoutMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS,
  backoffBaseMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS,
  backoffMaxMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS
};

test.after(() => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = envSnapshot.maxAttempts;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = envSnapshot.timeoutMs;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS = envSnapshot.backoffBaseMs;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS = envSnapshot.backoffMaxMs;
});

test('ConfiguredDeploymentLogArchiveUploader delegates upload-request creation to the archive upload provider', async () => {
  const uploader = new ConfiguredDeploymentLogArchiveUploader({
    async createUploadRequest(input) {
      assert.equal(input.fileName, 'dep-123.ndjson.gz');
      assert.equal(input.baseUrl, 'https://uploads.example.test');
      assert.equal(input.payload.toString(), 'fixture');
      return {
        targetUrl: 'https://uploads.example.test/dep-123.ndjson.gz',
        headers: { authorization: 'Bearer token' }
      };
    }
  });

  const request = await uploader.createUploadRequest({
    fileName: 'dep-123.ndjson.gz',
    baseUrl: 'https://uploads.example.test',
    payload: Buffer.from('fixture')
  });

  assert.deepEqual(request, {
    targetUrl: 'https://uploads.example.test/dep-123.ndjson.gz',
    headers: { authorization: 'Bearer token' }
  });
});

test('ConfiguredDeploymentLogArchiveUploader uploads archive payloads with the provided headers', async (t) => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;

  const requests: Array<{
    url: Parameters<typeof fetch>[0];
    init?: Parameters<typeof fetch>[1];
  }> = [];

  t.mock.method(globalThis, 'fetch', async (
    url: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    requests.push({ url, init });
    return new Response(null, { status: 200 });
  });

  const uploader = new ConfiguredDeploymentLogArchiveUploader({
    async createUploadRequest() {
      throw new Error('createUploadRequest should not be called by uploadWithRetry');
    }
  });

  await uploader.uploadWithRetry({
    targetUrl: 'https://uploads.example.test/dep-123.ndjson.gz',
    payload: Buffer.from('fixture'),
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/gzip'
    }
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, 'https://uploads.example.test/dep-123.ndjson.gz');
  assert.equal(requests[0]?.init?.method, 'PUT');
  const headers = requests[0]?.init?.headers as Record<string, string> | undefined;
  assert.equal(headers?.authorization, 'Bearer token');
});

test('ConfiguredDeploymentLogArchiveUploader retries and normalizes final request failures', async (t) => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 2;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS = 1;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS = 1;

  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    attempts += 1;
    throw new Error('socket hang up');
  });

  const uploader = new ConfiguredDeploymentLogArchiveUploader({
    async createUploadRequest() {
      throw new Error('createUploadRequest should not be called by uploadWithRetry');
    }
  });

  await assert.rejects(
    uploader.uploadWithRetry({
      targetUrl: 'https://uploads.example.test/dep-123.ndjson.gz',
      payload: Buffer.from('fixture'),
      headers: {
        'content-type': 'application/gzip'
      }
    }),
    /archive upload failed after retries: archive upload request failed: socket hang up/
  );

  assert.equal(attempts, 2);
});
