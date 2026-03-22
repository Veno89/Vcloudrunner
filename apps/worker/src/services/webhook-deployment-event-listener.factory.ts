import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { createOutboundHttpClient } from './http/outbound-http-client.factory.js';
import { WebhookDeploymentEventListener } from './webhook-deployment-event-listener.js';

const DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS = 10_000;

export function createWebhookDeploymentEventListener(): WebhookDeploymentEventListener {
  return new WebhookDeploymentEventListener(
    createOutboundHttpClient(),
    logger,
    {
      webhookUrl: env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL,
      webhookToken: env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN,
      timeoutMs: DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS
    }
  );
}
