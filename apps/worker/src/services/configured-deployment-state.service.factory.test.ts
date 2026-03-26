import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentStateService } = await import('./deployment-state.service.js');
const { createConfiguredDeploymentStateService } = await import('./configured-deployment-state.service.factory.js');

test('createConfiguredDeploymentStateService returns the configured deployment state service implementation', () => {
  const stateService = createConfiguredDeploymentStateService();

  assert.ok(stateService instanceof DeploymentStateService);
});
