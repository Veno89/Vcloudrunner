import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentStateRepository } = await import('./deployment-state.repository.js');
const { createDeploymentStateRepository } = await import('./deployment-state.repository.factory.js');

class MockPool {
  async query() {
    return { rows: [] };
  }
}

test('createDeploymentStateRepository returns the configured repository implementation', () => {
  const repository = createDeploymentStateRepository(new MockPool());

  assert.ok(repository instanceof DeploymentStateRepository);
});
