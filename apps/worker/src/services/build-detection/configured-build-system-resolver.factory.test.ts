import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ConfiguredBuildSystemResolver } = await import('./configured-build-system-resolver.js');
const {
  createConfiguredBuildSystemResolver
} = await import('./configured-build-system-resolver.factory.js');

test('createConfiguredBuildSystemResolver returns the configured build system resolver implementation', () => {
  const resolver = createConfiguredBuildSystemResolver();

  assert.ok(resolver instanceof ConfiguredBuildSystemResolver);
});
