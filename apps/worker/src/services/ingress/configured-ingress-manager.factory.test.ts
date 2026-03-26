import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { CaddyService } = await import('../caddy.service.js');
const { createConfiguredIngressManager } = await import('./configured-ingress-manager.factory.js');

test('createConfiguredIngressManager returns the configured ingress manager implementation', () => {
  const ingressManager = createConfiguredIngressManager();

  assert.ok(ingressManager instanceof CaddyService);
});

test('createConfiguredIngressManager supports overriding the ingress manager factory', () => {
  const ingressManager = {
    async upsertRoute() {},
    async deleteRoute() {}
  };

  assert.equal(
    createConfiguredIngressManager({
      createCaddyService: () => ingressManager
    }),
    ingressManager
  );
});
