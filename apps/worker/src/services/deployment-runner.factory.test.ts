import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentRunner } = await import('./deployment-runner.js');
const { createDeploymentRunner } = await import('./deployment-runner.factory.js');

test('createDeploymentRunner returns the configured deployment runner implementation', () => {
  const runner = createDeploymentRunner();

  assert.ok(runner instanceof DeploymentRunner);
});
