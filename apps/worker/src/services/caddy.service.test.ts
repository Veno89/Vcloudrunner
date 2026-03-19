import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { CaddyService } = await import('./caddy.service.js');

function withCaddyEnv(t: TestContext, caddyAdminUrl: string) {
  const originalUrl = env.CADDY_ADMIN_URL;
  env.CADDY_ADMIN_URL = caddyAdminUrl;

  t.after(() => {
    env.CADDY_ADMIN_URL = originalUrl;
  });
}

test('upsertRoute sends the expected Caddy route payload with a timeout signal', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService();
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 200 });
    }
  );

  await service.upsertRoute({
    host: 'app.example.test',
    upstreamPort: 4321
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://caddy.internal:2019/id/vcloudrunner/routes/app.example.test');
  assert.equal(calls[0]?.init?.method, 'PUT');
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal);

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

  const service = new CaddyService();

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('connect ETIMEDOUT');
  });

  await assert.rejects(
    service.upsertRoute({
      host: 'app.example.test',
      upstreamPort: 4321
    }),
    /CADDY_ROUTE_UPDATE_FAILED: connect ETIMEDOUT/
  );
});

test('upsertRoute preserves non-OK Caddy responses in the failure message', async (t) => {
  withCaddyEnv(t, 'http://caddy.internal:2019');

  const service = new CaddyService();

  t.mock.method(globalThis, 'fetch', async () => (
    new Response('route rejected', { status: 502 })
  ));

  await assert.rejects(
    service.upsertRoute({
      host: 'app.example.test',
      upstreamPort: 4321
    }),
    /CADDY_ROUTE_UPDATE_FAILED: 502 route rejected/
  );
});
