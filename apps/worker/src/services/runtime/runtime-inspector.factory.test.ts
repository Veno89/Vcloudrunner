import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeInspector } = await import('./docker-runtime-inspector.js');
const { createRuntimeInspector } = await import('./runtime-inspector.factory.js');

test('createRuntimeInspector returns the configured runtime inspector implementation', () => {
  const inspector = createRuntimeInspector();

  assert.ok(inspector instanceof DockerRuntimeInspector);
});
