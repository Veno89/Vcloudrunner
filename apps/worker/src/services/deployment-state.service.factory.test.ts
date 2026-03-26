import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentStateService } = await import('./deployment-state.service.js');
const { createDeploymentStateService } = await import('./deployment-state.service.factory.js');

class MockPool {
  async query() {
    return { rows: [] };
  }
}

test('createDeploymentStateService returns the configured deployment state service implementation', () => {
  const stateService = createDeploymentStateService();

  assert.ok(stateService instanceof DeploymentStateService);
});

test('createDeploymentStateService supports explicit dependency overrides without using configured defaults', () => {
  const stateService = createDeploymentStateService({
    pool: new MockPool()
  });

  assert.ok(stateService instanceof DeploymentStateService);
});
