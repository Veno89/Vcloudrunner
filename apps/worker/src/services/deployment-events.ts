import { EventEmitter } from 'node:events';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { createOutboundHttpClient } from './http/outbound-http-client.factory.js';
import { OutboundHttpRequestError } from './http/outbound-http-client.js';

const DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS = 10_000;
const outboundHttpClient = createOutboundHttpClient();

export type DeploymentEventType =
  | 'deployment.queued'
  | 'deployment.building'
  | 'deployment.running'
  | 'deployment.failed'
  | 'deployment.stopped'
  | 'deployment.cancelled';

export interface DeploymentEvent {
  type: DeploymentEventType;
  deploymentId: string;
  projectId?: string;
  projectSlug?: string;
  correlationId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

type DeploymentEventListener = (event: DeploymentEvent) => void;

class DeploymentEventBus extends EventEmitter {
  emit(type: 'deployment', event: DeploymentEvent): boolean {
    return super.emit(type, event);
  }

  on(type: 'deployment', listener: DeploymentEventListener): this {
    return super.on(type, listener);
  }
}

export const deploymentEvents = new DeploymentEventBus();

export function emitDeploymentEvent(event: DeploymentEvent): void {
  deploymentEvents.emit('deployment', event);
}

deploymentEvents.on('deployment', (event) => {
  const url = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL.trim();
  if (url.length === 0) return;

  void deliverWebhook(url, event).catch((error) => {
    logger.warn('deployment lifecycle webhook delivery failed', {
      type: event.type,
      deploymentId: event.deploymentId,
      message: error instanceof Error ? error.message : String(error)
    });
  });
});

async function deliverWebhook(url: string, event: DeploymentEvent): Promise<void> {
  const body = JSON.stringify(event);
  const token = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Vcloudrunner-Event': event.type
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await outboundHttpClient.request({
      url,
      timeoutMs: DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS,
      init: {
        method: 'POST',
        headers,
        body
      }
    });
  } catch (error) {
    const message =
      error instanceof OutboundHttpRequestError && error.timedOut
        ? error.message
        : `request failed: ${error instanceof Error ? error.message : String(error)}`;
    throw new Error(`deployment lifecycle webhook ${message}`);
  }

  if (!response.ok) {
    logger.warn('deployment lifecycle webhook returned non-OK status', {
      status: response.status,
      type: event.type,
      deploymentId: event.deploymentId
    });
  }
}
