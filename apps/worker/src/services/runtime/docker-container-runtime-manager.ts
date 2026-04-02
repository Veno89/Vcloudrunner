import type {
  ContainerRuntimeManager,
  RuntimeContainerSummary,
  RuntimeNetworkSummary,
  StartContainerInput,
  StartedContainerResult
} from './container-runtime-manager.js';

interface DockerContainerLike {
  start(): Promise<void>;
  inspect(): Promise<{
    Id: string;
    NetworkSettings: {
      Ports: Record<string, Array<{ HostPort: string }> | undefined>;
    };
  }>;
}

interface DockerNetworkLike {
  connect(input: { Container: string }): Promise<void>;
}

interface DockerClientLike {
  listNetworks(input: { filters: { name: string[] } }): Promise<Array<{ Name?: string }>>;
  createNetwork(input: {
    Name: string;
    Driver: string;
    Internal: boolean;
    Labels: Record<string, string>;
  }): Promise<void>;
  listContainers(input: {
    all: boolean;
    filters: { name: string[] };
  }): Promise<Array<{ Id: string; State: string }>>;
  getContainer(containerId: string): {
    stop(input: { t: number }): Promise<void>;
    remove(input: { force: boolean }): Promise<void>;
  };
  getNetwork(networkName: string): DockerNetworkLike;
  createContainer(input: {
    name: string;
    Image: string;
    User: string;
    Env: string[];
    ExposedPorts: Record<string, Record<string, never>>;
    NetworkingConfig?: {
      EndpointsConfig: Record<string, {
        Aliases?: string[];
      }>;
    };
    Healthcheck?: {
      Test: string[];
      Interval: number;
      Timeout: number;
      Retries: number;
      StartPeriod: number;
    };
    HostConfig: {
      PublishAllPorts: boolean;
      Memory: number;
      NanoCpus: number;
      PidsLimit: number;
      ReadonlyRootfs: boolean;
      RestartPolicy: { Name: string };
      NetworkMode: string;
    };
  }): Promise<DockerContainerLike>;
}

export class DockerContainerRuntimeManager implements ContainerRuntimeManager {
  constructor(private readonly docker: DockerClientLike) {}

  async listNetworksByName(name: string): Promise<RuntimeNetworkSummary[]> {
    const networks = await this.docker.listNetworks({ filters: { name: [name] } });

    return networks.map((network: { Name?: string }) => ({
      name: network.Name
    }));
  }

  async createNetwork(name: string): Promise<void> {
    await this.docker.createNetwork({
      Name: name,
      Driver: 'bridge',
      Internal: false,
      Labels: { 'managed-by': 'vcloudrunner' }
    });
  }

  async listContainersByName(name: string): Promise<RuntimeContainerSummary[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { name: [name] }
    });

    return containers.map((container: { Id: string; State: string }) => ({
      id: container.Id,
      state: container.State
    }));
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).stop({ t: 10 });
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.docker.getContainer(containerId).remove({ force: true });
  }

  async startContainer(input: StartContainerInput): Promise<StartedContainerResult> {
    const exposedPort = `${input.containerPort}/tcp`;
    const additionalNetworkNames = (input.additionalNetworkNames ?? [])
      .filter((networkName, index, items) => (
        networkName.length > 0
        && networkName !== input.networkName
        && items.indexOf(networkName) === index
      ));
    const restartPolicyName = input.restartPolicy ?? 'unless-stopped';
    const container = await this.docker.createContainer({
      name: input.name,
      Image: input.imageTag,
      User: '1000:1000',
      Env: Object.entries(input.env).map(([key, value]) => `${key}=${value}`),
      ExposedPorts: { [exposedPort]: {} },
      ...(input.networkAliases && input.networkAliases.length > 0
        ? {
            NetworkingConfig: {
              EndpointsConfig: {
                [input.networkName]: {
                  Aliases: input.networkAliases
                }
              }
            }
          }
        : {}),
      ...(input.healthCheck
        ? {
            Healthcheck: {
              Test: ['CMD-SHELL', input.healthCheck.command],
              Interval: input.healthCheck.intervalSeconds * 1_000_000_000,
              Timeout: input.healthCheck.timeoutSeconds * 1_000_000_000,
              Retries: input.healthCheck.retries,
              StartPeriod: input.healthCheck.startPeriodSeconds * 1_000_000_000
            }
          }
        : {}),
      HostConfig: {
        PublishAllPorts: input.publishPort,
        Memory: input.memoryMb * 1024 * 1024,
        NanoCpus: input.cpuMillicores * 1_000_000,
        PidsLimit: 256,
        ReadonlyRootfs: false,
        RestartPolicy: { Name: restartPolicyName },
        NetworkMode: input.networkName
      }
    });

    await container.start();
    const inspected = await container.inspect();

    for (const networkName of additionalNetworkNames) {
      await this.docker.getNetwork(networkName).connect({
        Container: inspected.Id
      });
    }

    const hostPort = inspected.NetworkSettings.Ports[exposedPort]?.[0]?.HostPort;

    return {
      containerId: inspected.Id,
      hostPort: hostPort ? Number(hostPort) : null
    };
  }
}
