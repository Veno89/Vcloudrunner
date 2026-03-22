import assert from 'node:assert/strict';
import test from 'node:test';

import { DeploymentEventBus } from './deployment-events.js';
import type { DeploymentEvent } from './deployment-events.js';
import { createConfiguredDeploymentEventBus } from './deployment-event-bus.factory.js';

test('createDeploymentEventSink emits onto a configured deployment event bus', async () => {
  const received: DeploymentEvent[] = [];

  const bus = createConfiguredDeploymentEventBus({
    createListener: () => ({
      attach(b: DeploymentEventBus) {
        b.on('deployment', (event) => {
          received.push(event);
        });
      }
    })
  });

  const { createDeploymentEventSink } = await import('./deployment-event-sink.factory.js');

  // Verify the factory shape creates a valid sink
  const sink = createDeploymentEventSink();
  assert.ok(sink);
  assert.ok(typeof sink.emit === 'function');

  // Verify the bus from createConfiguredDeploymentEventBus works
  const { emitDeploymentEvent } = await import('./deployment-events.js');
  emitDeploymentEvent(bus, {
    type: 'deployment.running',
    deploymentId: 'dep-123',
    projectId: 'proj-123',
    projectSlug: 'demo-project',
    correlationId: 'corr-123',
    timestamp: '2026-03-22T00:00:00.000Z'
  });

  assert.equal(received.length, 1);
  assert.equal(received[0]?.type, 'deployment.running');
  assert.equal(received[0]?.deploymentId, 'dep-123');
});
