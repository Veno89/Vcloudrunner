import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { createDockerClient } = await import('./docker-client.factory.js');

test('createDockerClient wires the configured Docker socket path', () => {
  class FakeDocker {
    constructor(public readonly options: { socketPath: string }) {}
  }

  const dockerClient = createDockerClient({
    DockerClass: FakeDocker as never
  }) as FakeDocker;

  assert.deepEqual(dockerClient.options, {
    socketPath: env.DOCKER_SOCKET_PATH
  });
});
