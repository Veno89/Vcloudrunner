import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { CaddyService } = await import('../caddy.service.js');
const { createIngressManager } = await import('./ingress-manager.factory.js');

test('createIngressManager returns the configured ingress manager implementation', () => {
  const ingressManager = createIngressManager();

  assert.ok(ingressManager instanceof CaddyService);
});
