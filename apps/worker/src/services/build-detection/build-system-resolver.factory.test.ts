import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredBuildSystemResolver } = await import('./configured-build-system-resolver.js');
const { createBuildSystemResolver } = await import('./build-system-resolver.factory.js');

test('createBuildSystemResolver returns the configured build system resolver implementation', () => {
  const resolver = createBuildSystemResolver();

  assert.ok(resolver instanceof ConfiguredBuildSystemResolver);
});
