import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerContainerRuntimeManager } = await import('./docker-container-runtime-manager.js');

function createDockerClientStub() {
  return {
    listNetworks: async (input: { filters: { name: string[] } }) => {
      void input;
      return [] as Array<{ Name?: string }>;
    },
    createNetwork: async (input: {
      Name: string;
      Driver: string;
      Internal: boolean;
      Labels: Record<string, string>;
    }) => {
      void input;
      return undefined;
    },
    listContainers: async (input: { all: boolean; filters: { name: string[] } }) => {
      void input;
      return [] as Array<{ Id: string; State: string }>;
    },
    getContainer: (containerId: string) => {
      void containerId;
      return {
      stop: async () => undefined,
      remove: async () => undefined
      };
    },
    getNetwork: (networkName: string) => {
      void networkName;
      return {
        connect: async (_input: { Container: string }): Promise<void> => {}
      };
    },
    createContainer: async (input: {
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
      HostConfig: {
        PublishAllPorts: boolean;
        Memory: number;
        NanoCpus: number;
        PidsLimit: number;
        ReadonlyRootfs: boolean;
        RestartPolicy: { Name: string };
        NetworkMode: string;
      };
    }) => {
      void input;
      return {
        start: async () => undefined,
        inspect: async () => ({
          Id: 'container-default',
          NetworkSettings: {
            Ports: {}
          }
        })
      };
    }
  };
}

test('listContainersByName maps docker container summaries into runtime manager summaries', async () => {
  const dockerClient = createDockerClientStub();
  dockerClient.listContainers = async () => [
    { Id: 'container-1', State: 'running' },
    { Id: 'container-2', State: 'exited' }
  ];

  const runtimeManager = new DockerContainerRuntimeManager(dockerClient);

  assert.deepEqual(await runtimeManager.listContainersByName('vcloudrunner-project-12345678'), [
    { id: 'container-1', state: 'running' },
    { id: 'container-2', state: 'exited' }
  ]);
});

test('createNetwork uses the managed bridge network configuration', async () => {
  const createCalls: Array<{
    Name: string;
    Driver: string;
    Internal: boolean;
      Labels: Record<string, string>;
  }> = [];

  const dockerClient = createDockerClientStub();
  dockerClient.createNetwork = async (input: {
    Name: string;
    Driver: string;
    Internal: boolean;
    Labels: Record<string, string>;
  }) => {
    createCalls.push(input);
  };

  const runtimeManager = new DockerContainerRuntimeManager(dockerClient);

  await runtimeManager.createNetwork('vcloudrunner-deployments');

  assert.deepEqual(createCalls, [
    {
      Name: 'vcloudrunner-deployments',
      Driver: 'bridge',
      Internal: false,
      Labels: { 'managed-by': 'vcloudrunner' }
    }
  ]);
});

test('startContainer creates, starts, and inspects the runtime container', async () => {
  let createInput:
    | {
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
        HostConfig: {
          PublishAllPorts: boolean;
          Memory: number;
          NanoCpus: number;
          PidsLimit: number;
          ReadonlyRootfs: boolean;
          RestartPolicy: { Name: string };
          NetworkMode: string;
        };
      }
    | undefined;
  let started = false;

  const dockerClient = createDockerClientStub();
  dockerClient.createContainer = async (input: {
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
    HostConfig: {
      PublishAllPorts: boolean;
      Memory: number;
      NanoCpus: number;
      PidsLimit: number;
      ReadonlyRootfs: boolean;
      RestartPolicy: { Name: string };
      NetworkMode: string;
    };
  }) => {
    createInput = input;

    return {
      async start() {
        started = true;
      },
      async inspect() {
        return {
          Id: 'container-123',
          NetworkSettings: {
            Ports: {
              '3000/tcp': [{ HostPort: '49152' }]
            }
          }
        };
      }
    };
  };

  const runtimeManager = new DockerContainerRuntimeManager(dockerClient);

  const result = await runtimeManager.startContainer({
    name: 'vcloudrunner-project-deadbeef',
    imageTag: 'vcloudrunner/project:dep-123',
    env: { NODE_ENV: 'production', PORT: '3000' },
    networkName: 'vcloudrunner-deployments',
    networkAliases: ['svc-demo-project-frontend'],
    containerPort: 3000,
    publishPort: true,
    memoryMb: 512,
    cpuMillicores: 500
  });

  assert.equal(started, true);
  assert.deepEqual(createInput, {
    name: 'vcloudrunner-project-deadbeef',
    Image: 'vcloudrunner/project:dep-123',
    User: '1000:1000',
    Env: ['NODE_ENV=production', 'PORT=3000'],
    ExposedPorts: { '3000/tcp': {} },
    NetworkingConfig: {
      EndpointsConfig: {
        'vcloudrunner-deployments': {
          Aliases: ['svc-demo-project-frontend']
        }
      }
    },
    HostConfig: {
      PublishAllPorts: true,
      Memory: 512 * 1024 * 1024,
      NanoCpus: 500 * 1_000_000,
      PidsLimit: 256,
      ReadonlyRootfs: false,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: 'vcloudrunner-deployments'
    }
  });
  assert.deepEqual(result, {
    containerId: 'container-123',
    hostPort: 49152
  });
});

test('startContainer can keep internal services off the host port map', async () => {
  let createInput:
    | {
        NetworkingConfig?: {
          EndpointsConfig: Record<string, {
            Aliases?: string[];
          }>;
        };
        HostConfig: {
          PublishAllPorts: boolean;
        };
      }
    | undefined;

  const dockerClient = createDockerClientStub();
  dockerClient.createContainer = async (input: {
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
    HostConfig: {
      PublishAllPorts: boolean;
      Memory: number;
      NanoCpus: number;
      PidsLimit: number;
      ReadonlyRootfs: boolean;
      RestartPolicy: { Name: string };
      NetworkMode: string;
    };
  }) => {
    createInput = {
      NetworkingConfig: input.NetworkingConfig,
      HostConfig: {
        PublishAllPorts: input.HostConfig.PublishAllPorts
      }
    };

    return {
      async start() {
        return undefined;
      },
      async inspect() {
        return {
          Id: 'container-internal',
          NetworkSettings: {
            Ports: {
              '3000/tcp': undefined
            }
          }
        };
      }
    };
  };

  const runtimeManager = new DockerContainerRuntimeManager(dockerClient);

  const result = await runtimeManager.startContainer({
    name: 'vcloudrunner-project-internal',
    imageTag: 'vcloudrunner/project:dep-internal',
    env: { NODE_ENV: 'production' },
    networkName: 'vcloudrunner-deployments',
    networkAliases: ['svc-demo-project-worker'],
    containerPort: 3000,
    publishPort: false,
    memoryMb: 512,
    cpuMillicores: 500
  });

  assert.deepEqual(createInput, {
    NetworkingConfig: {
      EndpointsConfig: {
        'vcloudrunner-deployments': {
          Aliases: ['svc-demo-project-worker']
        }
      }
    },
    HostConfig: {
      PublishAllPorts: false
    }
  });
  assert.deepEqual(result, {
    containerId: 'container-internal',
    hostPort: null
  });
});

test('startContainer connects the container to additional shared runtime networks', async () => {
  const connectedNetworks: Array<{ networkName: string; containerId: string }> = [];

  const dockerClient = createDockerClientStub();
  dockerClient.getNetwork = (networkName: string) => ({
    connect: async (input: { Container: string }) => {
      connectedNetworks.push({
        networkName,
        containerId: input.Container
      });
    }
  });
  dockerClient.createContainer = async () => ({
    async start() {
      return undefined;
    },
    async inspect() {
      return {
        Id: 'container-shared-network',
        NetworkSettings: {
          Ports: {
            '3000/tcp': [{ HostPort: '49153' }]
          }
        }
      };
    }
  });

  const runtimeManager = new DockerContainerRuntimeManager(dockerClient);

  await runtimeManager.startContainer({
    name: 'vcloudrunner-project-shared',
    imageTag: 'vcloudrunner/project:dep-shared',
    env: { NODE_ENV: 'production' },
    networkName: 'vcloudrunner-deployments',
    additionalNetworkNames: ['vcloudrunner-platform', 'vcloudrunner-platform', 'vcloudrunner-deployments'],
    containerPort: 3000,
    publishPort: true,
    memoryMb: 512,
    cpuMillicores: 500
  });

  assert.deepEqual(connectedNetworks, [
    {
      networkName: 'vcloudrunner-platform',
      containerId: 'container-shared-network'
    }
  ]);
});
