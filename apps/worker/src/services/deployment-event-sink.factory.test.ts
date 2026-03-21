import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { deploymentEvents } = await import('./deployment-events.js');
type DeploymentEvent = import('./deployment-events.js').DeploymentEvent;
const { createDeploymentEventSink } = await import('./deployment-event-sink.factory.js');

test('createDeploymentEventSink emits onto the shared deployment event bus', () => {
  const sink = createDeploymentEventSink();
  const received: DeploymentEvent[] = [];
  const listener = (event: DeploymentEvent) => {
    received.push(event);
  };

  deploymentEvents.on('deployment', listener);

  try {
    sink.emit({
      type: 'deployment.running',
      deploymentId: 'dep-123',
      projectId: 'proj-123',
      projectSlug: 'demo-project',
      correlationId: 'corr-123',
      timestamp: '2026-03-21T00:00:00.000Z'
    });
  } finally {
    deploymentEvents.removeListener('deployment', listener);
  }

  assert.equal(received.length, 1);
  assert.equal(received[0]?.type, 'deployment.running');
  assert.equal(received[0]?.deploymentId, 'dep-123');
});
