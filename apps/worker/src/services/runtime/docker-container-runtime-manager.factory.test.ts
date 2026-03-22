import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerContainerRuntimeManager } = await import('./docker-container-runtime-manager.js');
const {
  createDockerContainerRuntimeManager
} = await import('./docker-container-runtime-manager.factory.js');

test('createDockerContainerRuntimeManager returns the configured docker runtime manager implementation', () => {
  const runtimeManager = createDockerContainerRuntimeManager();

  assert.ok(runtimeManager instanceof DockerContainerRuntimeManager);
});
