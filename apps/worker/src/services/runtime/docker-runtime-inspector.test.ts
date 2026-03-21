import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeInspector } = await import('./docker-runtime-inspector.js');

test('isContainerRunning returns true when the runtime reports a running container', async () => {
  const inspector = new DockerRuntimeInspector({
    getContainer() {
      return {
        async inspect() {
          return {
            State: {
              Running: true
            }
          };
        }
      };
    }
  });

  assert.equal(await inspector.isContainerRunning('container-1'), true);
});

test('isContainerRunning returns false when the runtime reports a stopped container', async () => {
  const inspector = new DockerRuntimeInspector({
    getContainer() {
      return {
        async inspect() {
          return {
            State: {
              Running: false
            }
          };
        }
      };
    }
  });

  assert.equal(await inspector.isContainerRunning('container-1'), false);
});

test('isContainerRunning returns false when inspection throws', async () => {
  const inspector = new DockerRuntimeInspector({
    getContainer() {
      return {
        async inspect() {
          throw new Error('docker unavailable');
        }
      };
    }
  });

  assert.equal(await inspector.isContainerRunning('container-1'), false);
});
