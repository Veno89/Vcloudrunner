import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createOutboundHttpClient } = await import('./outbound-http-client.factory.js');
const { FetchOutboundHttpClient } = await import('./outbound-http-client.js');

test('createOutboundHttpClient returns the configured outbound HTTP client implementation', () => {
  const client = createOutboundHttpClient();

  assert.ok(client instanceof FetchOutboundHttpClient);
});
