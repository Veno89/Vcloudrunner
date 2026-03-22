import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredDeploymentImageBuilder } = await import('./configured-deployment-image-builder.js');
const {
  createConfiguredDeploymentImageBuilder
} = await import('./configured-deployment-image-builder.factory.js');

test('createConfiguredDeploymentImageBuilder returns the configured deployment image builder implementation', () => {
  const imageBuilder = createConfiguredDeploymentImageBuilder();

  assert.ok(imageBuilder instanceof ConfiguredDeploymentImageBuilder);
});
