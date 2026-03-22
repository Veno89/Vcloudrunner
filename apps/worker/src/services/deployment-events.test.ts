import assert from 'node:assert/strict';
import test from 'node:test';

import { DeploymentEventBus, emitDeploymentEvent } from './deployment-events.js';
import type { DeploymentEvent } from './deployment-events.js';

const baseEvent: DeploymentEvent = {
  type: 'deployment.running',
  deploymentId: '20000000-0000-0000-0000-000000000001',
  projectId: '10000000-0000-0000-0000-000000000001',
  projectSlug: 'example-project',
  correlationId: 'corr-123',
  timestamp: '2026-03-22T00:00:00.000Z',
  details: { hostPort: 4321 }
};

test('DeploymentEventBus emits events to registered listeners', () => {
  const bus = new DeploymentEventBus();
  const received: DeploymentEvent[] = [];
  bus.on('deployment', (event) => {
    received.push(event);
  });

  bus.emit('deployment', baseEvent);

  assert.equal(received.length, 1);
  assert.deepEqual(received[0], baseEvent);
});

test('emitDeploymentEvent emits onto the provided bus', () => {
  const bus = new DeploymentEventBus();
  const received: DeploymentEvent[] = [];
  bus.on('deployment', (event) => {
    received.push(event);
  });

  emitDeploymentEvent(bus, baseEvent);

  assert.equal(received.length, 1);
  assert.equal(received[0]?.type, 'deployment.running');
  assert.equal(received[0]?.deploymentId, baseEvent.deploymentId);
});

test('DeploymentEventBus supports multiple listeners', () => {
  const bus = new DeploymentEventBus();
  const received1: DeploymentEvent[] = [];
  const received2: DeploymentEvent[] = [];

  bus.on('deployment', (event) => {
    received1.push(event);
  });
  bus.on('deployment', (event) => {
    received2.push(event);
  });

  bus.emit('deployment', baseEvent);

  assert.equal(received1.length, 1);
  assert.equal(received2.length, 1);
});
