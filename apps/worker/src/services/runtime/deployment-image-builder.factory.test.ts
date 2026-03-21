import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredDeploymentImageBuilder } = await import('./configured-deployment-image-builder.js');
const { createDeploymentImageBuilder } = await import('./deployment-image-builder.factory.js');

test('createDeploymentImageBuilder returns the configured deployment image builder implementation', () => {
  const imageBuilder = createDeploymentImageBuilder();

  assert.ok(imageBuilder instanceof ConfiguredDeploymentImageBuilder);
});
