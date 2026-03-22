import { createDockerClient } from './docker-client.factory.js';
import { DockerRuntimeInspector } from './docker-runtime-inspector.js';

export function createDockerRuntimeInspector() {
  return new DockerRuntimeInspector(createDockerClient() as ConstructorParameters<typeof DockerRuntimeInspector>[0]);
}
