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
    createContainer: async (input: {
      name: string;
      Image: string;
      User: string;
      Env: string[];
      ExposedPorts: Record<string, Record<string, never>>;
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
    containerPort: 3000,
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
