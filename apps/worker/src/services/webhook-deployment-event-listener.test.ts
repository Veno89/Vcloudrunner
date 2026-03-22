import assert from 'node:assert/strict';
import test from 'node:test';

import { DeploymentEventBus } from './deployment-events.js';
import type { WebhookDeploymentEventListenerConfig, WebhookDeploymentEventListenerLogger } from './webhook-deployment-event-listener.js';
import { WebhookDeploymentEventListener } from './webhook-deployment-event-listener.js';
import type { OutboundHttpClient } from './http/outbound-http-client.js';
import type { DeploymentEvent } from './deployment-events.js';

const baseEvent: DeploymentEvent = {
  type: 'deployment.running',
  deploymentId: '20000000-0000-0000-0000-000000000001',
  projectId: '10000000-0000-0000-0000-000000000001',
  projectSlug: 'example-project',
  correlationId: 'corr-123',
  timestamp: '2026-03-22T00:00:00.000Z',
  details: { hostPort: 4321 }
};

function createStubLogger(): WebhookDeploymentEventListenerLogger & { warnings: Array<{ message: string; payload?: Record<string, unknown> }> } {
  const warnings: Array<{ message: string; payload?: Record<string, unknown> }> = [];
  return {
    warnings,
    warn(message: string, payload?: Record<string, unknown>) {
      warnings.push({ message, payload });
    }
  };
}

function createStubHttpClient(
  handler: (input: { url: string; timeoutMs: number; init: RequestInit }) => Promise<Response>
): OutboundHttpClient {
  return {
    request: handler
  };
}

function createConfig(overrides: Partial<WebhookDeploymentEventListenerConfig> = {}): WebhookDeploymentEventListenerConfig {
  return {
    webhookUrl: overrides.webhookUrl ?? 'https://hooks.example.test/deployments',
    webhookToken: overrides.webhookToken ?? '',
    timeoutMs: overrides.timeoutMs ?? 10_000
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

test('WebhookDeploymentEventListener skips delivery when the configured URL is blank after trimming', async () => {
  const logger = createStubLogger();
  const calls: unknown[] = [];
  const httpClient = createStubHttpClient(async (input) => {
    calls.push(input);
    return new Response(null, { status: 204 });
  });
  const config = createConfig({ webhookUrl: '   ' });

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(calls.length, 0);
});

test('WebhookDeploymentEventListener sends the lifecycle webhook with auth and correct headers', async () => {
  const logger = createStubLogger();
  const calls: Array<{ url: string; timeoutMs: number; init: RequestInit }> = [];
  const httpClient = createStubHttpClient(async (input) => {
    calls.push(input);
    return new Response(null, { status: 204 });
  });
  const config = createConfig({
    webhookUrl: 'https://hooks.example.test/deployments',
    webhookToken: 'worker-hook-token',
    timeoutMs: 10_000
  });

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://hooks.example.test/deployments');
  assert.equal(calls[0]?.timeoutMs, 10_000);
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.['Authorization'], 'Bearer worker-hook-token');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.['X-Vcloudrunner-Event'], 'deployment.running');

  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.deepEqual(body, baseEvent);
});

test('WebhookDeploymentEventListener omits Authorization header when token is empty', async () => {
  const logger = createStubLogger();
  const calls: Array<{ url: string; timeoutMs: number; init: RequestInit }> = [];
  const httpClient = createStubHttpClient(async (input) => {
    calls.push(input);
    return new Response(null, { status: 204 });
  });
  const config = createConfig({ webhookToken: '' });

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(calls.length, 1);
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.['Authorization'], undefined);
});

test('WebhookDeploymentEventListener logs a normalized warning when delivery throws', async () => {
  const logger = createStubLogger();
  const httpClient = createStubHttpClient(async () => {
    throw new Error('socket hang up');
  });
  const config = createConfig();

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(logger.warnings.length, 1);
  assert.equal(logger.warnings[0]?.message, 'deployment lifecycle webhook delivery failed');
  assert.equal(logger.warnings[0]?.payload?.type, baseEvent.type);
  assert.equal(logger.warnings[0]?.payload?.deploymentId, baseEvent.deploymentId);
  assert.equal(
    logger.warnings[0]?.payload?.message,
    'deployment lifecycle webhook request failed: socket hang up'
  );
});

test('WebhookDeploymentEventListener logs a normalized warning when delivery times out', async () => {
  const logger = createStubLogger();
  const timeoutError = Object.assign(new Error('request timed out after 10000ms'), { timedOut: true });
  const httpClient = createStubHttpClient(async () => {
    throw timeoutError;
  });
  const config = createConfig();

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(logger.warnings.length, 1);
  assert.equal(logger.warnings[0]?.message, 'deployment lifecycle webhook delivery failed');
  assert.equal(
    logger.warnings[0]?.payload?.message,
    'deployment lifecycle webhook request timed out after 10000ms'
  );
});

test('WebhookDeploymentEventListener logs a warning when the webhook returns a non-OK status', async () => {
  const logger = createStubLogger();
  const httpClient = createStubHttpClient(async () => new Response(null, { status: 503 }));
  const config = createConfig();

  const listener = new WebhookDeploymentEventListener(httpClient, logger, config);
  const bus = new DeploymentEventBus();
  listener.attach(bus);

  bus.emit('deployment', baseEvent);
  await flushAsyncWork();

  assert.equal(logger.warnings.length, 1);
  assert.equal(logger.warnings[0]?.message, 'deployment lifecycle webhook returned non-OK status');
  assert.equal(logger.warnings[0]?.payload?.status, 503);
  assert.equal(logger.warnings[0]?.payload?.type, baseEvent.type);
  assert.equal(logger.warnings[0]?.payload?.deploymentId, baseEvent.deploymentId);
});
