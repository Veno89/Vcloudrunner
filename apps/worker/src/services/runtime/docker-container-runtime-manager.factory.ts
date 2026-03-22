import { createDockerClient } from './docker-client.factory.js';
import { DockerContainerRuntimeManager } from './docker-container-runtime-manager.js';

export function createDockerContainerRuntimeManager() {
  return new DockerContainerRuntimeManager(createDockerClient() as ConstructorParameters<typeof DockerContainerRuntimeManager>[0]);
}
