import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { CaddyService } = await import('./caddy.service.js');
const { createCaddyService } = await import('./caddy.service.factory.js');

test('createCaddyService returns the configured Caddy service implementation', () => {
  const service = createCaddyService();

  assert.ok(service instanceof CaddyService);
});
