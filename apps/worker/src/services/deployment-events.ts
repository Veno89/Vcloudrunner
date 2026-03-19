import { EventEmitter } from 'node:events';
import { logger } from '../logger/logger.js';
import { env } from '../config/env.js';

const DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

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

// Webhook delivery listener
deploymentEvents.on('deployment', (event) => {
  const url = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_URL.trim();
  if (url.length === 0) return;

  void deliverWebhook(url, event).catch((error) => {
    logger.warn('deployment lifecycle webhook delivery failed', {
      type: event.type,
      deploymentId: event.deploymentId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

async function deliverWebhook(url: string, event: DeploymentEvent): Promise<void> {
  const body = JSON.stringify(event);
  const token = env.DEPLOYMENT_LIFECYCLE_WEBHOOK_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Vcloudrunner-Event': event.type,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    throw controller.signal.aborted
      ? new Error(`deployment lifecycle webhook request timed out after ${DEPLOYMENT_LIFECYCLE_WEBHOOK_TIMEOUT_MS}ms`)
      : new Error(`deployment lifecycle webhook request failed: ${getErrorMessage(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    logger.warn('deployment lifecycle webhook returned non-OK status', {
      status: response.status,
      type: event.type,
      deploymentId: event.deploymentId,
    });
  }
}
