import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentStateRepository } = await import('./deployment-state.repository.js');
const { createConfiguredDeploymentStateRepository } = await import('./configured-deployment-state.repository.factory.js');

test('createConfiguredDeploymentStateRepository returns the configured repository implementation', () => {
  const repository = createConfiguredDeploymentStateRepository();

  assert.ok(repository instanceof DeploymentStateRepository);
});
