import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeExecutor } = await import('./docker-runtime-executor.js');
const { createDockerRuntimeExecutor } = await import('./docker-runtime-executor.factory.js');

test('createDockerRuntimeExecutor returns the configured docker runtime executor implementation', () => {
  const executor = createDockerRuntimeExecutor();

  assert.ok(executor instanceof DockerRuntimeExecutor);
});
