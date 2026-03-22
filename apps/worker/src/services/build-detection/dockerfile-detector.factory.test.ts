import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerfileBuildDetector } = await import('./dockerfile-detector.js');
const { createDockerfileBuildDetector } = await import('./dockerfile-detector.factory.js');

test('createDockerfileBuildDetector returns the configured Dockerfile detector implementation', () => {
  const detector = createDockerfileBuildDetector();

  assert.ok(detector instanceof DockerfileBuildDetector);
});
