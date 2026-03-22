import assert from 'node:assert/strict';
import test from 'node:test';

import { DeploymentEventBus } from './deployment-events.js';
import type { DeploymentEvent } from './deployment-events.js';
import { createConfiguredDeploymentEventBus } from './deployment-event-bus.factory.js';

test('createConfiguredDeploymentEventBus returns a DeploymentEventBus instance', () => {
  const bus = createConfiguredDeploymentEventBus({
    createListener: () => ({
      attach() {}
    })
  });

  assert.ok(bus instanceof DeploymentEventBus);
});

test('createConfiguredDeploymentEventBus attaches the provided listener to the bus', () => {
  let attached = false;
  const bus = createConfiguredDeploymentEventBus({
    createListener: () => ({
      attach(b: DeploymentEventBus) {
        attached = true;
        assert.ok(b instanceof DeploymentEventBus);
      }
    })
  });

  assert.ok(attached);
  assert.ok(bus instanceof DeploymentEventBus);
});

test('createConfiguredDeploymentEventBus produces a bus that emits events to attached listeners', () => {
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

  const event: DeploymentEvent = {
    type: 'deployment.running',
    deploymentId: 'dep-123',
    timestamp: '2026-03-22T00:00:00.000Z'
  };

  bus.emit('deployment', event);

  assert.equal(received.length, 1);
  assert.equal(received[0]?.deploymentId, 'dep-123');
});
