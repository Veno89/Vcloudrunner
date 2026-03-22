import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeInspector } = await import('./docker-runtime-inspector.js');
const { createDockerRuntimeInspector } = await import('./docker-runtime-inspector.factory.js');

test('createDockerRuntimeInspector returns the configured docker runtime inspector implementation', () => {
  const inspector = createDockerRuntimeInspector();

  assert.ok(inspector instanceof DockerRuntimeInspector);
});
