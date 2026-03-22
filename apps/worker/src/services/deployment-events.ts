import { EventEmitter } from 'node:events';

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

export class DeploymentEventBus extends EventEmitter {
  emit(type: 'deployment', event: DeploymentEvent): boolean {
    return super.emit(type, event);
  }

  on(type: 'deployment', listener: DeploymentEventListener): this {
    return super.on(type, listener);
  }
}

export function emitDeploymentEvent(bus: DeploymentEventBus, event: DeploymentEvent): void {
  bus.emit('deployment', event);
}
