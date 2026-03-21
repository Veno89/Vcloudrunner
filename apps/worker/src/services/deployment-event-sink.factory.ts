import { emitDeploymentEvent } from './deployment-events.js';
import type { DeploymentEventSink } from './deployment-event-sink.js';

export function createDeploymentEventSink(): DeploymentEventSink {
  return {
    emit(event) {
      emitDeploymentEvent(event);
    }
  };
}
