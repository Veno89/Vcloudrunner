import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { GoogleAuthGcsAccessTokenResolver } = await import('./google-auth-gcs-access-token-resolver.js');
const { createGcsAccessTokenResolver } = await import('./gcs-access-token-resolver.factory.js');

test('createGcsAccessTokenResolver returns the Google-auth-backed resolver implementation', () => {
  const resolver = createGcsAccessTokenResolver();

  assert.ok(resolver instanceof GoogleAuthGcsAccessTokenResolver);
});
