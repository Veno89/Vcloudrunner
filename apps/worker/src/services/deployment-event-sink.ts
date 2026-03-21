import type { DeploymentEvent } from './deployment-events.js';

export interface DeploymentEventSink {
  emit(event: DeploymentEvent): void;
}
