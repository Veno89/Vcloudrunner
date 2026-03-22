import type { DeploymentEvent, DeploymentEventBus } from './deployment-events.js';
import type { OutboundHttpClient, OutboundHttpRequestError } from './http/outbound-http-client.js';

export interface WebhookDeploymentEventListenerLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface WebhookDeploymentEventListenerConfig {
  webhookUrl: string;
  webhookToken: string;
  timeoutMs: number;
}

export class WebhookDeploymentEventListener {
  constructor(
    private readonly httpClient: OutboundHttpClient,
    private readonly logger: WebhookDeploymentEventListenerLogger,
    private readonly config: WebhookDeploymentEventListenerConfig
  ) {}

  attach(bus: DeploymentEventBus): void {
    bus.on('deployment', (event) => {
      const url = this.config.webhookUrl.trim();
      if (url.length === 0) return;

      void this.deliverWebhook(url, event).catch((error) => {
        this.logger.warn('deployment lifecycle webhook delivery failed', {
          type: event.type,
          deploymentId: event.deploymentId,
          message: error instanceof Error ? error.message : String(error)
        });
      });
    });
  }

  private async deliverWebhook(url: string, event: DeploymentEvent): Promise<void> {
    const body = JSON.stringify(event);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Vcloudrunner-Event': event.type
    };
    if (this.config.webhookToken) {
      headers['Authorization'] = `Bearer ${this.config.webhookToken}`;
    }

    let response: Response;
    try {
      response = await this.httpClient.request({
        url,
        timeoutMs: this.config.timeoutMs,
        init: {
          method: 'POST',
          headers,
          body
        }
      });
    } catch (error) {
      const isTimeout =
        typeof error === 'object' &&
        error !== null &&
        'timedOut' in error &&
        (error as { timedOut: boolean }).timedOut;
      const message = isTimeout
        ? (error as OutboundHttpRequestError).message
        : `request failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(`deployment lifecycle webhook ${message}`);
    }

    if (!response.ok) {
      this.logger.warn('deployment lifecycle webhook returned non-OK status', {
        status: response.status,
        type: event.type,
        deploymentId: event.deploymentId
      });
    }
  }
}
