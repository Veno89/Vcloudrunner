import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

await import('../test/worker-test-env.js');

const {
  ROOT_DEPLOYMENT_SOURCE_ROOT,
  normalizeDeploymentSourceRoot,
  resolveDeploymentProjectPath
} = await import('./deployment-source-root.js');
const { DeploymentFailure } = await import('../workers/deployment-errors.js');

test('normalizeDeploymentSourceRoot defaults blank values to the repository root', () => {
  assert.equal(normalizeDeploymentSourceRoot(), ROOT_DEPLOYMENT_SOURCE_ROOT);
  assert.equal(normalizeDeploymentSourceRoot('  '), ROOT_DEPLOYMENT_SOURCE_ROOT);
  assert.equal(normalizeDeploymentSourceRoot('./'), ROOT_DEPLOYMENT_SOURCE_ROOT);
});

test('normalizeDeploymentSourceRoot trims and normalizes repo-relative service roots', () => {
  assert.equal(normalizeDeploymentSourceRoot(' apps\\frontend/ '), 'apps/frontend');
  assert.equal(resolveDeploymentProjectPath('repo-dir', 'apps/frontend'), join('repo-dir', 'apps', 'frontend'));
});

test('normalizeDeploymentSourceRoot rejects escaping or absolute service roots', () => {
  for (const invalidSourceRoot of ['../apps/frontend', '/apps/frontend', 'C:/apps/frontend']) {
    assert.throws(
      () => normalizeDeploymentSourceRoot(invalidSourceRoot),
      (error: unknown) =>
        error instanceof DeploymentFailure &&
        error.code === 'DEPLOYMENT_CONFIGURATION_ERROR' &&
        error.retryable === false
    );
  }
});
