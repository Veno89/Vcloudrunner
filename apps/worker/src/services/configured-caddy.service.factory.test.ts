import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { createConfiguredCaddyService } = await import('./configured-caddy.service.factory.js');
const { CaddyService } = await import('./caddy.service.js');

test('createConfiguredCaddyService returns the configured Caddy service implementation', () => {
  const service = createConfiguredCaddyService();

  assert.ok(service instanceof CaddyService);
});

test('createConfiguredCaddyService wires the provided outbound HTTP client into the service', () => {
  const outboundHttpClient = {
    async request() {
      return new Response(null, { status: 204 });
    }
  };

  class FakeCaddyService {
    constructor(public readonly client: typeof outboundHttpClient) {}
  }

  const service = createConfiguredCaddyService({
    createOutboundHttpClient: () => outboundHttpClient,
    ServiceClass: FakeCaddyService as never
  }) as unknown as FakeCaddyService;

  assert.equal(service.client, outboundHttpClient);
});
