import { env } from '../config/env.js';
import { logger as defaultLogger } from '../logger/logger.js';
import { createConfiguredOutboundHttpClient } from './http/configured-outbound-http-client.factory.js';
import type { OutboundHttpClient } from './http/outbound-http-client.js';
import {
  WebhookDeploymentEventListener,
  type WebhookDeploymentEventListenerConfig,
  type WebhookDeploymentEventListenerLogger
} from './webhook-deployment-event-listener.js';

const DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS = 10_000;

export type WebhookDeploymentEventListenerConstructor = new (
  httpClient: OutboundHttpClient,
  logger: WebhookDeploymentEventListenerLogger,
  config: WebhookDeploymentEventListenerConfig
) => WebhookDeploymentEventListener;

export interface CreateConfiguredWebhookDeploymentEventListenerOptions {
  createOutboundHttpClient?: () => OutboundHttpClient;
  logger?: WebhookDeploymentEventListenerLogger;
  config?: Partial<WebhookDeploymentEventListenerConfig>;
  ListenerClass?: WebhookDeploymentEventListenerConstructor;
}

export function createConfiguredWebhookDeploymentEventListener(
  options: CreateConfiguredWebhookDeploymentEventListenerOptions = {}
): WebhookDeploymentEventListener {
  const createOutboundHttpClientFn =
    options.createOutboundHttpClient ?? createConfiguredOutboundHttpClient;
  const resolvedLogger = options.logger ?? defaultLogger;
  const ListenerClass = options.ListenerClass ?? WebhookDeploymentEventListener;

  return new ListenerClass(createOutboundHttpClientFn(), resolvedLogger, {
    webhookUrl: options.config?.webhookUrl ?? env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL,
    webhookToken: options.config?.webhookToken ?? env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN,
    timeoutMs: options.config?.timeoutMs ?? DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS
  });
}
