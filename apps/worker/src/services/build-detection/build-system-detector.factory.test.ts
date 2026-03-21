import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerfileBuildDetector } = await import('./dockerfile-detector.js');
const { createBuildSystemDetectors } = await import('./build-system-detector.factory.js');

test('createBuildSystemDetectors returns the configured detector implementations', () => {
  const detectors = createBuildSystemDetectors();

  assert.equal(detectors.length, 1);
  assert.ok(detectors[0] instanceof DockerfileBuildDetector);
});
