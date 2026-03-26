import Docker from 'dockerode';

import { env } from '../../config/env.js';
import type { DockerConstructor } from './docker-client.factory.js';

interface CreateConfiguredDockerClientOptions {
  DockerClass?: DockerConstructor;
}

export function createConfiguredDockerClient(
  options: CreateConfiguredDockerClientOptions = {}
) {
  const DockerClass = options.DockerClass ?? (Docker as unknown as DockerConstructor);

  return new DockerClass({
    socketPath: env.DOCKER_SOCKET_PATH
  });
}
