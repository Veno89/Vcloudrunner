import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createConfiguredOutboundHttpClient } = await import('./configured-outbound-http-client.factory.js');
const { FetchOutboundHttpClient } = await import('./outbound-http-client.js');

test('createConfiguredOutboundHttpClient returns the configured outbound HTTP client implementation', () => {
  const client = createConfiguredOutboundHttpClient();

  assert.ok(client instanceof FetchOutboundHttpClient);
});

test('createConfiguredOutboundHttpClient supports overriding the HTTP client implementation', () => {
  class FakeHttpClient {
    async request() {
      return new Response(null, { status: 204 });
    }
  }

  const client = createConfiguredOutboundHttpClient({
    ClientClass: FakeHttpClient as never
  });

  assert.ok(client instanceof FakeHttpClient);
});
