import type { RuntimeInspector } from './runtime-inspector.js';
import { createDockerClient } from './docker-client.factory.js';

interface DockerContainerLike {
  inspect(): Promise<{ State?: { Running?: boolean } }>;
}

interface DockerClientLike {
  getContainer(containerId: string): DockerContainerLike;
}

export class DockerRuntimeInspector implements RuntimeInspector {
  constructor(
    private readonly docker: DockerClientLike = createDockerClient() as DockerClientLike
  ) {}

  async isContainerRunning(containerId: string): Promise<boolean> {
    try {
      const info = await this.docker.getContainer(containerId).inspect();
      return info.State?.Running === true;
    } catch {
      return false;
    }
  }
}
