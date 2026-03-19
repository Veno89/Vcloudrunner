import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { DeploymentStateService } = await import('./deployment-state.service.js');

class MockPool {
  async query() {
    return { rows: [] };
  }
}

interface CapturedRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

async function startCaptureServer() {
  const requests: CapturedRequest[] = [];

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    requests.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
      body: Buffer.concat(chunks)
    });

    res.statusCode = 200;
    res.end('ok');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to resolve capture server address');
  }

  return {
    requests,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        })
      );
    }
  };
}

const envSnapshot = {
  provider: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER,
  baseUrl: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL,
  authToken: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN,
  archiveDir: env.DEPLOYMENT_LOG_ARCHIVE_DIR,
  maxAttempts: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS,
  timeoutMs: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS,
  deleteLocal: env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD,
  s3Bucket: env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET,
  s3Prefix: env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX,
  s3Region: env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION,
  s3AccessKeyId: env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID,
  s3Secret: env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY,
  s3SessionToken: env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN,
  gcsBucket: env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET,
  gcsPrefix: env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX,
  gcsToken: env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN,
  azureContainer: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER,
  azurePrefix: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX,
  azureName: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME,
  azureKey: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY
};

test.after(() => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = envSnapshot.provider;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = envSnapshot.baseUrl;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN = envSnapshot.authToken;
  env.DEPLOYMENT_LOG_ARCHIVE_DIR = envSnapshot.archiveDir;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = envSnapshot.maxAttempts;
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = envSnapshot.timeoutMs;
  env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD = envSnapshot.deleteLocal;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET = envSnapshot.s3Bucket;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX = envSnapshot.s3Prefix;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION = envSnapshot.s3Region;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID = envSnapshot.s3AccessKeyId;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY = envSnapshot.s3Secret;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN = envSnapshot.s3SessionToken;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = envSnapshot.gcsBucket;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = envSnapshot.gcsPrefix;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = envSnapshot.gcsToken;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER = envSnapshot.azureContainer;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX = envSnapshot.azurePrefix;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME = envSnapshot.azureName;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY = envSnapshot.azureKey;
});


async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withArchiveFixture(testName: string) {
  const dir = await mkdtemp(join(tmpdir(), `vcloudrunner-${testName}-`));
  const fileName = 'dep-fixture.ndjson.gz';
  const filePath = join(dir, fileName);
  const payload = Buffer.from('gzip-content-fixture');
  await writeFile(filePath, payload);

  return {
    dir,
    fileName,
    payload,
    cleanup: async () => rm(dir, { recursive: true, force: true })
  };
}

test('uploadPendingArchives sends signed/authenticated S3 request to configured endpoint', async () => {
  const fixture = await withArchiveFixture('s3');
  const server = await startCaptureServer();

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 's3';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = server.baseUrl;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
    env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET = 'my-bucket';
    env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX = 'archives';
    env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION = 'us-east-1';
    env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID = 'AKIAEXAMPLE';
    env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY = 'secret-example';
    env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN = 'session-token-example';

    const service = new DeploymentStateService(new MockPool());
    const uploaded = await service.uploadPendingArchives();

    assert.equal(uploaded, 1);
    assert.equal(server.requests.length, 1);
    const [request] = server.requests;
    assert.equal(request.method, 'PUT');
    assert.equal(request.url, `/my-bucket/archives/${fixture.fileName}`);
    assert.equal(request.headers['content-type'], 'application/gzip');
    assert.match(String(request.headers.authorization), /^AWS4-HMAC-SHA256 Credential=/);
    assert.equal(request.headers['x-amz-security-token'], 'session-token-example');
    assert.equal(request.body.toString(), fixture.payload.toString());
  } finally {
    await server.close();
    await fixture.cleanup();
  }
});

test('uploadPendingArchives sends bearer-authenticated GCS request with static token', async () => {
  const fixture = await withArchiveFixture('gcs');
  const server = await startCaptureServer();

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = server.baseUrl;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = 'gcs-static-token';

    const service = new DeploymentStateService(new MockPool());
    const uploaded = await service.uploadPendingArchives();

    assert.equal(uploaded, 1);
    assert.equal(server.requests.length, 1);
    const [request] = server.requests;
    assert.equal(request.method, 'PUT');
    assert.equal(request.url, `/gcs-bucket/archives/${fixture.fileName}`);
    assert.equal(request.headers.authorization, 'Bearer gcs-static-token');
    assert.equal(request.headers['content-type'], 'application/gzip');
  } finally {
    await server.close();
    await fixture.cleanup();
  }
});

test('uploadPendingArchives sends shared-key signed Azure request', async () => {
  const fixture = await withArchiveFixture('azure');
  const server = await startCaptureServer();

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'azure';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = server.baseUrl;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER = 'logs';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX = 'archives';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME = 'devstoreaccount1';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY = Buffer.from('local-secret').toString('base64');

    const service = new DeploymentStateService(new MockPool());
    const uploaded = await service.uploadPendingArchives();

    assert.equal(uploaded, 1);
    assert.equal(server.requests.length, 1);
    const [request] = server.requests;
    assert.equal(request.method, 'PUT');
    assert.equal(request.url, `/logs/archives/${fixture.fileName}`);
    assert.match(String(request.headers.authorization), /^SharedKey devstoreaccount1:/);
    assert.equal(request.headers['x-ms-blob-type'], 'BlockBlob');
    assert.equal(request.headers['content-type'], 'application/gzip');
  } finally {
    await server.close();
    await fixture.cleanup();
  }
});


test('uploadPendingArchives is idempotent after marker is written', async () => {
  const fixture = await withArchiveFixture('idempotent');
  const server = await startCaptureServer();

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = server.baseUrl;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
    env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = 'gcs-static-token';

    const service = new DeploymentStateService(new MockPool());
    const first = await service.uploadPendingArchives();
    const second = await service.uploadPendingArchives();

    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.equal(server.requests.length, 1);
    const markerPath = join(fixture.dir, `${fixture.fileName}.uploaded`);
    assert.equal(await exists(markerPath), true);
  } finally {
    await server.close();
    await fixture.cleanup();
  }
});

test('uploadPendingArchives removes local archive when delete-local-after-upload is enabled', async () => {
  const fixture = await withArchiveFixture('delete-local');
  const server = await startCaptureServer();

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'azure';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = server.baseUrl;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 1;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
    env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD = true;
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER = 'logs';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX = 'archives';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME = 'devstoreaccount1';
    env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY = Buffer.from('local-secret').toString('base64');

    const service = new DeploymentStateService(new MockPool());
    const uploaded = await service.uploadPendingArchives();

    assert.equal(uploaded, 1);
    assert.equal(server.requests.length, 1);
    const archivePath = join(fixture.dir, fixture.fileName);
    const markerPath = `${archivePath}.uploaded`;
    assert.equal(await exists(archivePath), false);
    assert.equal(await exists(markerPath), true);
  } finally {
    env.DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD = false;
    await server.close();
    await fixture.cleanup();
  }
});

test('createArchiveUploadRequest wraps GCS token fetch network failures with a stable message', async (t) => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });

  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = 'worker@example.test';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  }).toString();

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up');
  });

  const service = new DeploymentStateService(new MockPool());

  await assert.rejects(
    service.createArchiveUploadRequest({
      fileName: 'dep-fixture.ndjson.gz',
      baseUrl: 'https://storage.googleapis.com/upload/storage/v1/b',
      payload: Buffer.from('fixture')
    }),
    /failed to obtain GCS access token: request failed: socket hang up/
  );
});

test('createArchiveUploadRequest wraps GCS token fetch timeout failures with a stable message', async (t) => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });

  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = 'worker@example.test';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  }).toString();

  const timeoutHandle = { timeout: true } as unknown as ReturnType<typeof setTimeout>;
  t.mock.method(globalThis, 'setTimeout', (((handler: () => void) => {
    handler();
    return timeoutHandle;
  }) as unknown) as typeof setTimeout);
  t.mock.method(globalThis, 'clearTimeout', (() => undefined) as typeof clearTimeout);
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if ((init?.signal as AbortSignal | undefined)?.aborted) {
        throw new Error('aborted by signal');
      }

      throw new Error('expected timeout abort');
    }
  );

  const service = new DeploymentStateService(new MockPool());

  await assert.rejects(
    service.createArchiveUploadRequest({
      fileName: 'dep-fixture.ndjson.gz',
      baseUrl: 'https://storage.googleapis.com/upload/storage/v1/b',
      payload: Buffer.from('fixture')
    }),
    /failed to obtain GCS access token: request timed out after 2000ms/
  );
});

test('createArchiveUploadRequest wraps invalid GCS token JSON responses with a stable message', async (t) => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });

  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = 'worker@example.test';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  }).toString();

  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } })
  );

  const service = new DeploymentStateService(new MockPool());

  await assert.rejects(
    service.createArchiveUploadRequest({
      fileName: 'dep-fixture.ndjson.gz',
      baseUrl: 'https://storage.googleapis.com/upload/storage/v1/b',
      payload: Buffer.from('fixture')
    }),
    /failed to obtain GCS access token: invalid JSON response/
  );
});

test('createArchiveUploadRequest falls back to the default GCS token TTL when expires_in is invalid', async (t) => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });

  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = 'worker@example.test';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = privateKey.export({
    type: 'pkcs8',
    format: 'pem'
  }).toString();

  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        access_token: 'gcs-cached-token',
        expires_in: 'not-a-number'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  });

  const service = new DeploymentStateService(new MockPool());

  const first = await service.createArchiveUploadRequest({
    fileName: 'dep-fixture.ndjson.gz',
    baseUrl: 'https://storage.googleapis.com/upload/storage/v1/b',
    payload: Buffer.from('fixture')
  });
  const second = await service.createArchiveUploadRequest({
    fileName: 'dep-fixture.ndjson.gz',
    baseUrl: 'https://storage.googleapis.com/upload/storage/v1/b',
    payload: Buffer.from('fixture')
  });

  assert.equal(first.headers.authorization, 'Bearer gcs-cached-token');
  assert.equal(second.headers.authorization, 'Bearer gcs-cached-token');
  assert.equal(fetchCalls, 1);
});

test('uploadPendingArchives continues after repeated network failures on one artifact', async (t) => {
  const fixture = await withArchiveFixture('network-failure');

  try {
    env.DEPLOYMENT_LOG_ARCHIVE_DIR = fixture.dir;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'http';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BASE_URL = 'https://uploads.example.test';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_AUTH_TOKEN = 'upload-token';
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS = 2;
    env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_TIMEOUT_MS = 2_000;

    t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('socket hang up');
    });

    const service = new DeploymentStateService(new MockPool());
    const uploaded = await service.uploadPendingArchives();

    assert.equal(uploaded, 0);
    const markerPath = join(fixture.dir, `${fixture.fileName}.uploaded`);
    assert.equal(await exists(markerPath), false);
  } finally {
    await fixture.cleanup();
  }
});
