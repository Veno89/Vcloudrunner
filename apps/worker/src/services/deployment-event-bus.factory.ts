import { DeploymentEventBus } from './deployment-events.js';
import { createConfiguredWebhookDeploymentEventListener } from './configured-webhook-deployment-event-listener.factory.js';

export interface DeploymentEventListener {
  attach(bus: DeploymentEventBus): void;
}

interface CreateConfiguredDeploymentEventBusOptions {
  createListener?: () => DeploymentEventListener;
}

export function createConfiguredDeploymentEventBus(
  options: CreateConfiguredDeploymentEventBusOptions = {}
): DeploymentEventBus {
  const createListenerFn = options.createListener ?? createConfiguredWebhookDeploymentEventListener;

  const bus = new DeploymentEventBus();
  const listener = createListenerFn();
  listener.attach(bus);

  return bus;
}
