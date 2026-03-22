import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { CaddyService } = await import('./caddy.service.js');
const { OutboundHttpRequestError } = await import('./http/outbound-http-client.js');

function withCaddyEnv(t: TestContext, caddyAdminUrl: string) {
  const originalUrl = env.CADDY_ADMIN_URL;
  env.CADDY_ADMIN_URL = caddyAdminUrl;

  t.after(() => {
    env.CADDY_ADMIN_URL = originalUrl;
  });
}

test('upsertRoute sends the expected Caddy route payload with the configured timeout', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const calls: Array<{ url: string; timeoutMs: number; init?: RequestInit }> = [];
  const service = new CaddyService({
    async request(input) {
      calls.push(input);
      return new Response(null, { status: 200 });
    }
  });

  await service.upsertRoute({
    host: 'app.example.test',
    upstreamPort: 4321
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://caddy.internal:2019/id/vcloudrunner/routes/app.example.test');
  assert.equal(calls[0]?.timeoutMs, 10_000);
  assert.equal(calls[0]?.init?.method, 'PUT');

  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(body, {
    '@id': 'vcloudrunner/routes/app.example.test',
    match: [
      {
        host: ['app.example.test']
      }
    ],
    handle: [
      {
        handler: 'reverse_proxy',
        upstreams: [
          {
            dial: '127.0.0.1:4321'
          }
        ]
      }
    ]
  });
});

test('upsertRoute wraps Caddy network failures with a stable error prefix', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      throw new OutboundHttpRequestError({
        timedOut: false,
        message: 'connect ETIMEDOUT'
      });
    }
  });

  await assert.rejects(
    service.upsertRoute({
      host: 'app.example.test',
      upstreamPort: 4321
    }),
    /CADDY_ROUTE_UPDATE_FAILED: connect ETIMEDOUT/
  );
});

test('upsertRoute normalizes timeout failures with a stable error prefix', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      throw new OutboundHttpRequestError({
        timedOut: true,
        message: 'request timed out after 10000ms'
      });
    }
  });

  await assert.rejects(
    service.upsertRoute({
      host: 'app.example.test',
      upstreamPort: 4321
    }),
    /CADDY_ROUTE_UPDATE_FAILED: request timed out after 10000ms/
  );
});

test('upsertRoute preserves non-OK Caddy responses in the failure message', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      return new Response('route rejected', { status: 502 });
    }
  });

  await assert.rejects(
    service.upsertRoute({
      host: 'app.example.test',
      upstreamPort: 4321
    }),
    /CADDY_ROUTE_UPDATE_FAILED: 502 route rejected/
  );
});

test('deleteRoute sends the expected Caddy delete request with the configured timeout', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const calls: Array<{ url: string; timeoutMs: number; init?: RequestInit }> = [];
  const service = new CaddyService({
    async request(input) {
      calls.push(input);
      return new Response(null, { status: 200 });
    }
  });

  await service.deleteRoute({
    host: 'app.example.test'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://caddy.internal:2019/id/vcloudrunner/routes/app.example.test');
  assert.equal(calls[0]?.timeoutMs, 10_000);
  assert.equal(calls[0]?.init?.method, 'DELETE');
});

test('deleteRoute treats missing routes as an idempotent success', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      return new Response('route not found', { status: 404 });
    }
  });

  await service.deleteRoute({
    host: 'app.example.test'
  });
});

test('deleteRoute wraps Caddy network failures with a stable error prefix', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      throw new OutboundHttpRequestError({
        timedOut: false,
        message: 'connect ETIMEDOUT'
      });
    }
  });

  await assert.rejects(
    service.deleteRoute({
      host: 'app.example.test'
    }),
    /CADDY_ROUTE_DELETE_FAILED: connect ETIMEDOUT/
  );
});

test('deleteRoute normalizes timeout failures with a stable error prefix', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      throw new OutboundHttpRequestError({
        timedOut: true,
        message: 'request timed out after 10000ms'
      });
    }
  });

  await assert.rejects(
    service.deleteRoute({
      host: 'app.example.test'
    }),
    /CADDY_ROUTE_DELETE_FAILED: request timed out after 10000ms/
  );
});

test('deleteRoute preserves non-OK Caddy responses in the failure message', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService({
    async request() {
      return new Response('route delete rejected', { status: 502 });
    }
  });

  await assert.rejects(
    service.deleteRoute({
      host: 'app.example.test'
    }),
    /CADDY_ROUTE_DELETE_FAILED: 502 route delete rejected/
  );
});
