import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createDeploymentWorkspaceManager } = await import('./deployment-workspace-manager.factory.js');
const { LocalDeploymentWorkspaceManager } = await import('./local-deployment-workspace-manager.js');

test('createDeploymentWorkspaceManager returns the configured workspace manager implementation', () => {
  const workspaceManager = createDeploymentWorkspaceManager();

  assert.ok(workspaceManager instanceof LocalDeploymentWorkspaceManager);
});
