import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { logger } = await import('../logger/logger.js');
const { DeploymentRunner } = await import('./deployment-runner.js');

test('ensureDeploymentNetwork tolerates already-exists races and caches the result', async (t) => {
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const listCalls: Array<{ filters: { name: string[] } }> = [];
  const createCalls: Array<{ Name: string }> = [];

  t.mock.method(logger, 'info', (message: string, metadata?: Record<string, unknown>) => {
    infos.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    docker: {
      listNetworks: (input: { filters: { name: string[] } }) => Promise<Array<{ Name?: string }>>;
      createNetwork: (input: {
        Name: string;
        Driver: string;
        Internal: boolean;
        Labels: Record<string, string>;
      }) => Promise<void>;
    };
    ensureDeploymentNetwork: () => Promise<string>;
  };

  let listAttempt = 0;
  runner.docker = {
    listNetworks: async (input) => {
      listCalls.push(input);
      listAttempt += 1;
      return listAttempt === 1 ? [] : [{ Name: 'vcloudrunner-deployments' }];
    },
    createNetwork: async (input) => {
      createCalls.push({ Name: input.Name });
      const error = new Error('network with name vcloudrunner-deployments already exists') as Error & {
        statusCode?: number;
      };
      error.statusCode = 409;
      throw error;
    }
  };

  const firstNetworkName = await runner.ensureDeploymentNetwork();
  const secondNetworkName = await runner.ensureDeploymentNetwork();

  assert.equal(firstNetworkName, 'vcloudrunner-deployments');
  assert.equal(secondNetworkName, 'vcloudrunner-deployments');
  assert.deepEqual(createCalls, [{ Name: 'vcloudrunner-deployments' }]);
  assert.equal(listCalls.length, 2);
  assert.equal(infos.length, 0);
});

test('ensureDeploymentNetwork rethrows unexpected network creation failures', async () => {
  const runner = new DeploymentRunner() as unknown as {
    docker: {
      listNetworks: (input: { filters: { name: string[] } }) => Promise<Array<{ Name?: string }>>;
      createNetwork: (input: {
        Name: string;
        Driver: string;
        Internal: boolean;
        Labels: Record<string, string>;
      }) => Promise<void>;
    };
    ensureDeploymentNetwork: () => Promise<string>;
  };

  runner.docker = {
    listNetworks: async () => [],
    createNetwork: async () => {
      throw new Error('docker daemon unavailable');
    }
  };

  await assert.rejects(
    runner.ensureDeploymentNetwork(),
    /docker daemon unavailable/
  );
});

test('removeContainerByName continues removing later stale containers when one removal fails', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const stopCalls: string[] = [];
  const removeCalls: string[] = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });
  t.mock.method(logger, 'info', (message: string, metadata?: Record<string, unknown>) => {
    infos.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    docker: {
      listContainers: (input: { all: boolean; filters: { name: string[] } }) => Promise<Array<{ Id: string; State: string }>>;
      getContainer: (id: string) => {
        stop: (input: { t: number }) => Promise<void>;
        remove: (input: { force: boolean }) => Promise<void>;
      };
    };
    removeContainerByName: (containerName: string) => Promise<void>;
  };

  runner.docker = {
    listContainers: async () => [
      { Id: 'container-a', State: 'running' },
      { Id: 'container-b', State: 'running' }
    ],
    getContainer: (id: string) => ({
      stop: async () => {
        stopCalls.push(id);
      },
      remove: async () => {
        removeCalls.push(id);
        if (id === 'container-a') {
          throw new Error('already being removed');
        }
      }
    })
  };

  await runner.removeContainerByName('vcloudrunner-project-12345678');

  assert.deepEqual(stopCalls, ['container-a', 'container-b']);
  assert.deepEqual(removeCalls, ['container-a', 'container-b']);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'failed removing stale container before retry');
  assert.equal(warnings[0]?.metadata?.containerId, 'container-a');
  assert.equal(infos.length, 1);
  assert.equal(infos[0]?.message, 'removed stale deployment container before run');
  assert.equal(infos[0]?.metadata?.removedCount, 1);
});

test('removeContainerByName avoids success logging when every stale removal fails', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });
  t.mock.method(logger, 'info', (message: string, metadata?: Record<string, unknown>) => {
    infos.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    docker: {
      listContainers: () => Promise<Array<{ Id: string; State: string }>>;
      getContainer: (id: string) => {
        stop: () => Promise<void>;
        remove: () => Promise<void>;
      };
    };
    removeContainerByName: (containerName: string) => Promise<void>;
  };

  runner.docker = {
    listContainers: async () => [
      { Id: 'container-a', State: 'exited' }
    ],
    getContainer: () => ({
      stop: async () => undefined,
      remove: async () => {
        throw new Error('permission denied');
      }
    })
  };

  await runner.removeContainerByName('vcloudrunner-project-12345678');

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'failed removing stale container before retry');
  assert.equal(infos.length, 0);
});

test('cleanupCancelledRun rethrows real teardown failures after attempting both cleanup steps', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const containerCleanupCalls: string[] = [];
  const imageCleanupCalls: string[] = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeContainerForce: (containerId: string) => Promise<void>;
    removeImageForce: (imageTag: string) => Promise<void>;
    cleanupCancelledRun: (input: {
      deploymentId: string;
      containerId: string;
      imageTag: string;
    }) => Promise<void>;
  };

  runner.removeContainerForce = async (containerId) => {
    containerCleanupCalls.push(containerId);
    throw new Error('permission denied');
  };
  runner.removeImageForce = async (imageTag) => {
    imageCleanupCalls.push(imageTag);
    throw new Error('image busy');
  };

  await assert.rejects(
    runner.cleanupCancelledRun({
      deploymentId: 'dep-123',
      containerId: 'container-123',
      imageTag: 'image-tag'
    }),
    /deployment runtime cleanup incomplete: container remove failed: permission denied; image remove failed: image busy/
  );

  assert.deepEqual(containerCleanupCalls, ['container-123']);
  assert.deepEqual(imageCleanupCalls, ['image-tag']);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0]?.message, 'failed removing container after cancellation');
  assert.equal(warnings[1]?.message, 'failed removing image after cancellation');
});

test('cleanupCancelledRun ignores already-gone runtime resources', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeContainerForce: (containerId: string) => Promise<void>;
    removeImageForce: (imageTag: string) => Promise<void>;
    cleanupCancelledRun: (input: {
      deploymentId: string;
      containerId: string;
      imageTag: string;
    }) => Promise<void>;
  };

  runner.removeContainerForce = async () => {
    const error = new Error('No such container: container-123') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  };
  runner.removeImageForce = async () => {
    throw new Error('Error response from daemon: No such image: image-tag');
  };

  await runner.cleanupCancelledRun({
    deploymentId: 'dep-123',
    containerId: 'container-123',
    imageTag: 'image-tag'
  });

  assert.equal(warnings.length, 0);
});
