import Docker from 'dockerode';

import { env } from '../../config/env.js';

type DockerConstructor = new (options: { socketPath: string }) => unknown;

interface CreateDockerClientOptions {
  DockerClass?: DockerConstructor;
}

export function createDockerClient(options: CreateDockerClientOptions = {}) {
  const DockerClass = options.DockerClass ?? (Docker as unknown as DockerConstructor);

  return new DockerClass({
    socketPath: env.DOCKER_SOCKET_PATH
  });
}
