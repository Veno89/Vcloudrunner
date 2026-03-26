import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const {
  createConfiguredWebhookDeploymentEventListener
} = await import('./configured-webhook-deployment-event-listener.factory.js');
const { WebhookDeploymentEventListener } = await import('./webhook-deployment-event-listener.js');

test('createConfiguredWebhookDeploymentEventListener returns the configured listener implementation', () => {
  const listener = createConfiguredWebhookDeploymentEventListener();

  assert.ok(listener instanceof WebhookDeploymentEventListener);
});

test('createConfiguredWebhookDeploymentEventListener wires the configured webhook defaults', () => {
  const outboundHttpClient = {
    async request() {
      return new Response(null, { status: 204 });
    }
  };
  const logger = {
    warn() {}
  };

  class FakeListener {
    constructor(
      public readonly httpClient: typeof outboundHttpClient,
      public readonly listenerLogger: typeof logger,
      public readonly config: {
        webhookUrl: string;
        webhookToken: string;
        timeoutMs: number;
      }
    ) {}
  }

  const listener = createConfiguredWebhookDeploymentEventListener({
    createOutboundHttpClient: () => outboundHttpClient,
    logger,
    ListenerClass: FakeListener as never
  }) as unknown as FakeListener;

  assert.equal(listener.httpClient, outboundHttpClient);
  assert.equal(listener.listenerLogger, logger);
  assert.deepEqual(listener.config, {
    webhookUrl: env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL,
    webhookToken: env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN,
    timeoutMs: 10_000
  });
});
