import test from 'node:test';
import assert from 'node:assert/strict';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { createDeploymentStateService } = await import('./deployment-state.service.factory.js');

class MockPool {
  async query() {
    return { rows: [] };
  }
}

const service = createDeploymentStateService({ pool: new MockPool() });

const baseEnv = {
  provider: env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER,
  s3Bucket: env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET,
  s3Prefix: env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX,
  s3Region: env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION,
  s3AccessKeyId: env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID,
  s3SecretAccessKey: env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY,
  s3SessionToken: env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN,
  gcsBucket: env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET,
  gcsPrefix: env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX,
  gcsAccessToken: env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN,
  azureContainer: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER,
  azurePrefix: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX,
  azureAccountName: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME,
  azureAccountKey: env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY
};

function setS3Env(overrides?: Partial<typeof baseEnv>) {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 's3';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET = 'my-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION = 'us-east-1';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID = 'AKIAEXAMPLE';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY = 'secret-example';
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN = 'session-token-example';

  if (!overrides) {
    return;
  }

  if (overrides.s3Bucket !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET = overrides.s3Bucket;
  if (overrides.s3Prefix !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX = overrides.s3Prefix;
  if (overrides.s3Region !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION = overrides.s3Region;
  if (overrides.s3AccessKeyId !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID = overrides.s3AccessKeyId;
  if (overrides.s3SecretAccessKey !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY = overrides.s3SecretAccessKey;
  if (overrides.s3SessionToken !== undefined) env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN = overrides.s3SessionToken;
}

test.after(() => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = baseEnv.provider;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_BUCKET = baseEnv.s3Bucket;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_PREFIX = baseEnv.s3Prefix;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_REGION = baseEnv.s3Region;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID = baseEnv.s3AccessKeyId;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SECRET_ACCESS_KEY = baseEnv.s3SecretAccessKey;
  env.DEPLOYMENT_LOG_ARCHIVE_S3_SESSION_TOKEN = baseEnv.s3SessionToken;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = baseEnv.gcsBucket;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = baseEnv.gcsPrefix;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = baseEnv.gcsAccessToken;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER = baseEnv.azureContainer;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX = baseEnv.azurePrefix;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME = baseEnv.azureAccountName;
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY = baseEnv.azureAccountKey;
});

test('s3 provider creates a native archive upload request for the configured bucket and key', async () => {
  setS3Env();

  const request = await service.createArchiveUploadRequest({
    fileName: 'dep-1.ndjson.gz',
    baseUrl: 'https://s3.amazonaws.com',
    payload: Buffer.from('hello')
  });

  assert.equal(request.provider, 's3');
  assert.equal(request.transport, 'native');
  assert.match(request.targetUrl, /^https:\/\/s3\.amazonaws\.com\/my-bucket\/archives\//);
  assert.equal(request.headers['content-type'], 'application/gzip');
  if (request.provider !== 's3') {
    throw new Error('expected s3 archive upload request');
  }
  assert.equal(request.bucket, 'my-bucket');
  assert.equal(request.key, 'archives/dep-1.ndjson.gz');
  assert.equal(request.endpoint, 'https://s3.amazonaws.com');
});

test('gcs provider uses static bearer token when configured', async () => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'gcs';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_BUCKET = 'gcs-bucket';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = 'gcs-static-token';

  const request = await service.createArchiveUploadRequest({
    fileName: 'dep-3.ndjson.gz',
    baseUrl: 'https://storage.googleapis.com',
    payload: Buffer.from('gcs')
  });

  assert.equal(request.provider, 'gcs');
  assert.equal(request.transport, 'http');
  assert.equal(request.headers.authorization, 'Bearer gcs-static-token');
  assert.equal(request.headers['content-type'], 'application/gzip');
  assert.match(request.targetUrl, /^https:\/\/storage\.googleapis\.com\/gcs-bucket\/archives\//);
});

test('azure provider creates a native blob upload request for the configured container and blob path', async () => {
  env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER = 'azure';
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_CONTAINER = 'logs';
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_PREFIX = 'archives';
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_NAME = 'devstoreaccount1';
  env.DEPLOYMENT_LOG_ARCHIVE_AZURE_ACCOUNT_KEY = Buffer.from('local-secret').toString('base64');

  const request = await service.createArchiveUploadRequest({
    fileName: 'dep-4.ndjson.gz',
    baseUrl: 'https://devstoreaccount1.blob.core.windows.net',
    payload: Buffer.from('azure')
  });

  assert.equal(request.provider, 'azure');
  assert.equal(request.transport, 'native');
  assert.equal(request.headers['content-type'], 'application/gzip');
  assert.match(request.targetUrl, /^https:\/\/devstoreaccount1\.blob\.core\.windows\.net\/logs\/archives\//);
  if (request.provider !== 'azure') {
    throw new Error('expected azure archive upload request');
  }
  assert.equal(request.container, 'logs');
  assert.equal(request.blobName, 'archives/dep-4.ndjson.gz');
  assert.equal(request.serviceUrl, 'https://devstoreaccount1.blob.core.windows.net');
});

test('s3 provider fails fast when credentials are missing', async () => {
  setS3Env({ s3AccessKeyId: '' });

  await assert.rejects(
    () =>
      service.createArchiveUploadRequest({
        fileName: 'dep-5.ndjson.gz',
        baseUrl: 'https://s3.amazonaws.com',
        payload: Buffer.from('no-creds')
      }),
    /missing DEPLOYMENT_LOG_ARCHIVE_S3_ACCESS_KEY_ID/
  );
});
