import { createConfiguredDockerClient } from './configured-docker-client.factory.js';

export type DockerConstructor = new (options: { socketPath: string }) => unknown;

interface CreateDockerClientOptions {
  DockerClass?: DockerConstructor;
}

export function createDockerClient(options: CreateDockerClientOptions = {}) {
  if (!options.DockerClass) {
    return createConfiguredDockerClient();
  }

  return createConfiguredDockerClient({
    DockerClass: options.DockerClass
  });
}
