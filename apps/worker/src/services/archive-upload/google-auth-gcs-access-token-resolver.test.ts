import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { GoogleAuthGcsAccessTokenResolver } = await import('./google-auth-gcs-access-token-resolver.js');

const envSnapshot = {
  accessToken: env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN,
  serviceAccountEmail: env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL,
  privateKey: env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY
};

test.after(() => {
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = envSnapshot.accessToken;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = envSnapshot.serviceAccountEmail;
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = envSnapshot.privateKey;
});

function setServiceAccountEnv() {
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = 'worker@example.test';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nfixture\\n-----END PRIVATE KEY-----';
}

test('GoogleAuthGcsAccessTokenResolver returns the static token without creating a JWT client', async () => {
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = 'gcs-static-token';

  let createCalls = 0;
  const resolver = new GoogleAuthGcsAccessTokenResolver(() => {
    createCalls += 1;
    return {
      async authorize() {
        return { access_token: 'unexpected-token' };
      }
    };
  });

  const token = await resolver.resolveAccessToken();

  assert.equal(token, 'gcs-static-token');
  assert.equal(createCalls, 0);
});

test('GoogleAuthGcsAccessTokenResolver fails fast when neither static token nor service-account credentials are configured', async () => {
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_SERVICE_ACCOUNT_EMAIL = '';
  env.DEPLOYMENT_LOG_ARCHIVE_GCS_PRIVATE_KEY = '';

  const resolver = new GoogleAuthGcsAccessTokenResolver();

  await assert.rejects(
    resolver.resolveAccessToken(),
    /missing GCS credentials: set DEPLOYMENT_LOG_ARCHIVE_GCS_ACCESS_TOKEN or service-account email\/private key/
  );
});

test('GoogleAuthGcsAccessTokenResolver wraps JWT authorization failures with a stable message', async () => {
  setServiceAccountEnv();

  const resolver = new GoogleAuthGcsAccessTokenResolver(() => ({
    async authorize() {
      throw new Error('socket hang up');
    }
  }));

  await assert.rejects(
    resolver.resolveAccessToken(),
    /failed to obtain GCS access token: request failed: socket hang up/
  );
});

test('GoogleAuthGcsAccessTokenResolver rejects authorize results that omit the access token', async () => {
  setServiceAccountEnv();

  const resolver = new GoogleAuthGcsAccessTokenResolver(() => ({
    async authorize() {
      return { access_token: '   ' };
    }
  }));

  await assert.rejects(
    resolver.resolveAccessToken(),
    /failed to obtain GCS access token: missing access_token/
  );
});

test('GoogleAuthGcsAccessTokenResolver caches the resolved token using the fallback TTL when expiry metadata is missing', async () => {
  setServiceAccountEnv();

  let authorizeCalls = 0;
  const resolver = new GoogleAuthGcsAccessTokenResolver(() => ({
    async authorize() {
      authorizeCalls += 1;
      return { access_token: 'gcs-cached-token' };
    }
  }));

  const first = await resolver.resolveAccessToken();
  const second = await resolver.resolveAccessToken();

  assert.equal(first, 'gcs-cached-token');
  assert.equal(second, 'gcs-cached-token');
  assert.equal(authorizeCalls, 1);
});
