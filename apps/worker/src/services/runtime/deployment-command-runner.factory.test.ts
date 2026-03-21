import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createDeploymentCommandRunner } = await import('./deployment-command-runner.factory.js');
const { ShellDeploymentCommandRunner } = await import('./shell-deployment-command-runner.js');

test('createDeploymentCommandRunner returns the configured command runner implementation', () => {
  const commandRunner = createDeploymentCommandRunner();

  assert.ok(commandRunner instanceof ShellDeploymentCommandRunner);
});
