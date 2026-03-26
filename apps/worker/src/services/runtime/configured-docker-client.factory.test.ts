import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { env } = await import('../../config/env.js');
const { createConfiguredDockerClient } = await import('./configured-docker-client.factory.js');

test('createConfiguredDockerClient wires the configured Docker socket path', () => {
  class FakeDocker {
    constructor(public readonly options: { socketPath: string }) {}
  }

  const dockerClient = createConfiguredDockerClient({
    DockerClass: FakeDocker as never
  }) as FakeDocker;

  assert.deepEqual(dockerClient.options, {
    socketPath: env.DOCKER_SOCKET_PATH
  });
});
