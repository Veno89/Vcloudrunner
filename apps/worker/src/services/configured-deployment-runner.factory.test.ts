import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentRunner } = await import('./deployment-runner.js');
const { createConfiguredDeploymentRunner } = await import('./configured-deployment-runner.factory.js');

test('createConfiguredDeploymentRunner returns the configured deployment runner implementation', () => {
  const runner = createConfiguredDeploymentRunner();

  assert.ok(runner instanceof DeploymentRunner);
});
