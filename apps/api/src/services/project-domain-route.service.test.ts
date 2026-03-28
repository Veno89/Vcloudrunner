import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
process.env.CADDY_ADMIN_URL = 'http://caddy.internal:2019';

const {
  CaddyProjectDomainRouteService
} = await import('./project-domain-route.service.js');

test('deactivateRoute sends the expected Caddy admin delete request', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const service = new CaddyProjectDomainRouteService({
    fetchFn: async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return new Response(null, { status: 200 });
    }
  });

  await service.deactivateRoute({
    host: 'api.example.com'
  });

  assert.deepEqual(calls, [{
    url: 'http://caddy.internal:2019/id/vcloudrunner/routes/api.example.com',
    method: 'DELETE'
  }]);
});

test('deactivateRoute treats missing Caddy routes as an idempotent success', async () => {
  const service = new CaddyProjectDomainRouteService({
    fetchFn: async () => new Response('route not found', { status: 404 })
  });

  await service.deactivateRoute({
    host: 'api.example.com'
  });
});

test('deactivateRoute surfaces non-success Caddy responses', async () => {
  const service = new CaddyProjectDomainRouteService({
    fetchFn: async () => new Response('route delete rejected', { status: 502 })
  });

  await assert.rejects(
    () => service.deactivateRoute({
      host: 'api.example.com'
    }),
    /CADDY_ROUTE_DELETE_FAILED: 502 route delete rejected/
  );
});
