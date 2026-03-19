import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { logger } = await import('../logger/logger.js');
const { emitDeploymentEvent } = await import('./deployment-events.js');

const baseEvent = {
  type: 'deployment.running' as const,
  deploymentId: '20000000-0000-0000-0000-000000000001',
  projectId: '10000000-0000-0000-0000-000000000001',
  projectSlug: 'example-project',
  correlationId: 'corr-123',
  timestamp: '2026-03-19T00:00:00.000Z',
  details: { hostPort: 4321 }
};

function withWebhookEnv(
  t: TestContext,
  overrides: {
    url: string;
    token?: string;
  }
) {
  const originalUrl = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL;
  const originalToken = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN;

  env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL = overrides.url;
  env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN = overrides.token ?? '';

  t.after(() => {
    env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL = originalUrl;
    env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN = originalToken;
  });
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

test('emitDeploymentEvent skips webhook delivery when the configured URL is blank after trimming', async (t) => {
  withWebhookEnv(t, { url: '   ' });

  let fetchCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetchCalls += 1;
    return new Response(null, { status: 204 });
  });

  emitDeploymentEvent(baseEvent);
  await flushAsyncWork();

  assert.equal(fetchCalls, 0);
});

test('emitDeploymentEvent sends the lifecycle webhook with auth and timeout signal', async (t) => {
  withWebhookEnv(t, {
    url: 'https://hooks.example.test/deployments',
    token: 'worker-hook-token'
  });

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    }
  );

  emitDeploymentEvent(baseEvent);
  await flushAsyncWork();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://hooks.example.test/deployments');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.Authorization, 'Bearer worker-hook-token');

  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(body, baseEvent);
});

test('emitDeploymentEvent logs a normalized warning when webhook delivery throws', async (t) => {
  withWebhookEnv(t, {
    url: 'https://hooks.example.test/deployments'
  });

  const warnings: Array<{ message: string; payload?: Record<string, unknown> }> = [];
  t.mock.method(logger, 'warn', ((message: string, payload?: Record<string, unknown>) => {
    warnings.push({ message, payload });
  }) as typeof logger.warn);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up');
  });

  emitDeploymentEvent(baseEvent);
  await flushAsyncWork();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment lifecycle webhook delivery failed');
  assert.equal(warnings[0]?.payload?.type, baseEvent.type);
  assert.equal(warnings[0]?.payload?.deploymentId, baseEvent.deploymentId);
  assert.equal(
    warnings[0]?.payload?.message,
    'deployment lifecycle webhook request failed: socket hang up'
  );
});

test('emitDeploymentEvent logs a warning when the webhook returns a non-OK status', async (t) => {
  withWebhookEnv(t, {
    url: 'https://hooks.example.test/deployments'
  });

  const warnings: Array<{ message: string; payload?: Record<string, unknown> }> = [];
  t.mock.method(logger, 'warn', ((message: string, payload?: Record<string, unknown>) => {
    warnings.push({ message, payload });
  }) as typeof logger.warn);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));

  emitDeploymentEvent(baseEvent);
  await flushAsyncWork();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment lifecycle webhook returned non-OK status');
  assert.equal(warnings[0]?.payload?.status, 503);
  assert.equal(warnings[0]?.payload?.type, baseEvent.type);
  assert.equal(warnings[0]?.payload?.deploymentId, baseEvent.deploymentId);
});
