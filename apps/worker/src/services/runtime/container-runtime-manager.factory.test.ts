import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createContainerRuntimeManager } = await import('./container-runtime-manager.factory.js');
const { DockerContainerRuntimeManager } = await import('./docker-container-runtime-manager.js');

test('createContainerRuntimeManager returns the configured runtime manager implementation', () => {
  const runtimeManager = createContainerRuntimeManager();

  assert.ok(runtimeManager instanceof DockerContainerRuntimeManager);
});
