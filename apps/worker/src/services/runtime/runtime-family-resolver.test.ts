import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { resolveRuntimeFamily } = await import('./runtime-family-resolver.js');

test('resolveRuntimeFamily returns the supported docker runtime family', () => {
  assert.equal(resolveRuntimeFamily('docker'), 'docker');
});

test('resolveRuntimeFamily rejects unsupported runtime families', () => {
  assert.throws(
    () => resolveRuntimeFamily('containerd'),
    /Unsupported DEPLOYMENT_RUNTIME_EXECUTOR: containerd/
  );
});
