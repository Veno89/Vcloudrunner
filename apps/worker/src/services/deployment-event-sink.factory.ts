import { createConfiguredDeploymentEventBus } from './deployment-event-bus.factory.js';
import { emitDeploymentEvent } from './deployment-events.js';
import type { DeploymentEventSink } from './deployment-event-sink.js';

export function createDeploymentEventSink(): DeploymentEventSink {
  const bus = createConfiguredDeploymentEventBus();

  return {
    emit(event) {
      emitDeploymentEvent(bus, event);
    }
  };
}
