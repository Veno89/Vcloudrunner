import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeExecutor } = await import('./docker-runtime-executor.js');
const { createRuntimeExecutor } = await import('./runtime-executor.factory.js');

test('createRuntimeExecutor returns the configured runtime executor implementation', () => {
  const runtimeExecutor = createRuntimeExecutor();

  assert.ok(runtimeExecutor instanceof DockerRuntimeExecutor);
});
