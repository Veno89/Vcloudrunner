import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../config/env.js';
import { DeploymentStateService } from './deployment-state.service.js';

class MockPool {
  async query() {
    return { rows: [] };
  }
}

const service = new DeploymentStateService(new MockPool());

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

test('s3 provider builds sigv4 authorization headers for archive upload request', async () => {
  setS3Env();

  const request = await service.createArchiveUploadRequest({
    fileName: 'dep-1.ndjson.gz',
    baseUrl: 'https://s3.amazonaws.com',
    payload: Buffer.from('hello')
  });

  assert.match(request.targetUrl, /^https:\/\/s3\.amazonaws\.com\/my-bucket\/archives\//);
  assert.match(request.headers.authorization, /^AWS4-HMAC-SHA256 Credential=/);
  assert.equal(request.headers['content-type'], 'application/gzip');
  assert.ok(request.headers['x-amz-date']);
  assert.ok(request.headers['x-amz-content-sha256']);
});

test('s3 signed headers include session token when configured', async () => {
  setS3Env({ s3SessionToken: 'session-token-example' });

  const request = await service.createArchiveUploadRequest({
    fileName: 'dep-2.ndjson.gz',
    baseUrl: 'https://s3.amazonaws.com',
    payload: Buffer.from('world')
  });

  assert.equal(request.headers['x-amz-security-token'], 'session-token-example');
  assert.match(request.headers.authorization, /SignedHeaders=.*x-amz-security-token/);
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

  assert.equal(request.headers.authorization, 'Bearer gcs-static-token');
  assert.equal(request.headers['content-type'], 'application/gzip');
  assert.match(request.targetUrl, /^https:\/\/storage\.googleapis\.com\/gcs-bucket\/archives\//);
});

test('azure provider builds shared key authorization headers', async () => {
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

  assert.match(request.headers.authorization, /^SharedKey devstoreaccount1:/);
  assert.equal(request.headers['x-ms-blob-type'], 'BlockBlob');
  assert.equal(request.headers['content-type'], 'application/gzip');
  assert.match(request.targetUrl, /^https:\/\/devstoreaccount1\.blob\.core\.windows\.net\/logs\/archives\//);
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
