import {
  createConfiguredWebhookDeploymentEventListener,
  type CreateConfiguredWebhookDeploymentEventListenerOptions
} from './configured-webhook-deployment-event-listener.factory.js';
import { WebhookDeploymentEventListener } from './webhook-deployment-event-listener.js';

export function createWebhookDeploymentEventListener(
  options: CreateConfiguredWebhookDeploymentEventListenerOptions = {}
): WebhookDeploymentEventListener {
  return createConfiguredWebhookDeploymentEventListener(options);
}
