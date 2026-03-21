import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { logger } = await import('../logger/logger.js');
const { DeploymentRunner } = await import('./deployment-runner.js');

test('ensureDeploymentNetwork tolerates already-exists races and caches the result', async (t) => {
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const listCalls: string[] = [];
  const createCalls: string[] = [];

  t.mock.method(logger, 'info', (message: string, metadata?: Record<string, unknown>) => {
    infos.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    runtimeManager: {
      listNetworksByName: (name: string) => Promise<Array<{ name?: string }>>;
      createNetwork: (name: string) => Promise<void>;
    };
    ensureDeploymentNetwork: () => Promise<string>;
  };

  let listAttempt = 0;
  runner.runtimeManager = {
    listNetworksByName: async (name) => {
      listCalls.push(name);
      listAttempt += 1;
      return listAttempt === 1 ? [] : [{ name: 'vcloudrunner-deployments' }];
    },
    createNetwork: async (name) => {
      createCalls.push(name);
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
  assert.deepEqual(createCalls, ['vcloudrunner-deployments']);
  assert.equal(listCalls.length, 2);
  assert.equal(infos.length, 0);
});

test('ensureDeploymentNetwork rethrows unexpected network creation failures', async () => {
  const runner = new DeploymentRunner() as unknown as {
    runtimeManager: {
      listNetworksByName: (name: string) => Promise<Array<{ name?: string }>>;
      createNetwork: (name: string) => Promise<void>;
    };
    ensureDeploymentNetwork: () => Promise<string>;
  };

  runner.runtimeManager = {
    listNetworksByName: async () => [],
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
    runtimeManager: {
      listContainersByName: (name: string) => Promise<Array<{ id: string; state: string }>>;
      stopContainer: (containerId: string) => Promise<void>;
      removeContainer: (containerId: string) => Promise<void>;
    };
    removeContainerByName: (containerName: string) => Promise<void>;
  };

  runner.runtimeManager = {
    listContainersByName: async () => [
      { id: 'container-a', state: 'running' },
      { id: 'container-b', state: 'running' }
    ],
    stopContainer: async (id: string) => {
      stopCalls.push(id);
    },
    removeContainer: async (id: string) => {
      removeCalls.push(id);
      if (id === 'container-a') {
        throw new Error('already being removed');
      }
    }
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
    runtimeManager: {
      listContainersByName: () => Promise<Array<{ id: string; state: string }>>;
      stopContainer: (containerId: string) => Promise<void>;
      removeContainer: (containerId: string) => Promise<void>;
    };
    removeContainerByName: (containerName: string) => Promise<void>;
  };

  runner.runtimeManager = {
    listContainersByName: async () => [
      { id: 'container-a', state: 'exited' }
    ],
    stopContainer: async () => undefined,
    removeContainer: async () => {
      throw new Error('permission denied');
    }
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

test('cleanupFailedRun rethrows cleanup failures with the original deployment error context', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const containerCleanupCalls: string[] = [];
  const imageCleanupCalls: string[] = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeContainerForce: (containerId: string) => Promise<void>;
    removeImageForce: (imageTag: string) => Promise<void>;
    cleanupFailedRun: (input: {
      deploymentId: string;
      containerId: string | null;
      imageTag: string | null;
      originalError: unknown;
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
    runner.cleanupFailedRun({
      deploymentId: 'dep-123',
      containerId: 'container-123',
      imageTag: 'image-tag',
      originalError: new Error('repository not found')
    }),
    /repository not found \(deployment failure cleanup incomplete: container remove failed: permission denied; image remove failed: image busy\)/
  );

  assert.deepEqual(containerCleanupCalls, ['container-123']);
  assert.deepEqual(imageCleanupCalls, ['image-tag']);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0]?.message, 'failed removing container after deployment error');
  assert.equal(warnings[1]?.message, 'failed removing image after deployment error');
});

test('cleanupFailedRun ignores already-gone runtime resources after a deployment error', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeContainerForce: (containerId: string) => Promise<void>;
    removeImageForce: (imageTag: string) => Promise<void>;
    cleanupFailedRun: (input: {
      deploymentId: string;
      containerId: string | null;
      imageTag: string | null;
      originalError: unknown;
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

  await runner.cleanupFailedRun({
    deploymentId: 'dep-123',
    containerId: 'container-123',
    imageTag: 'image-tag',
    originalError: new Error('temporary unavailable from remote host')
  });

  assert.equal(warnings.length, 0);
});

test('cleanupFailedRun does not attempt workspace cleanup directly', async () => {
  let workspaceCleanupCalls = 0;

  const runner = new DeploymentRunner() as unknown as {
    removeContainerForce: (containerId: string) => Promise<void>;
    removeImageForce: (imageTag: string) => Promise<void>;
    removeWorkspace: (workspaceDir: string) => Promise<void>;
    cleanupFailedRun: (input: {
      deploymentId: string;
      containerId: string | null;
      imageTag: string | null;
      originalError: unknown;
    }) => Promise<void>;
  };

  runner.removeContainerForce = async () => undefined;
  runner.removeImageForce = async () => undefined;
  runner.removeWorkspace = async () => {
    workspaceCleanupCalls += 1;
  };

  await runner.cleanupFailedRun({
    deploymentId: 'dep-123',
    containerId: 'container-123',
    imageTag: 'image-tag',
    originalError: new Error('temporary unavailable from remote host')
  });

  assert.equal(workspaceCleanupCalls, 0);
});

test('cleanupWorkspaceBestEffort warns and continues when post-run workspace cleanup fails', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeWorkspace: (workspaceDir: string) => Promise<void>;
    cleanupWorkspaceBestEffort: (input: {
      deploymentId: string;
      workspaceDir: string;
      reason: 'post-run' | 'deployment-error';
    }) => Promise<void>;
  };

  runner.removeWorkspace = async () => {
    throw new Error('EPERM: workspace locked');
  };

  await runner.cleanupWorkspaceBestEffort({
    deploymentId: 'dep-123',
    workspaceDir: 'workspace',
    reason: 'post-run'
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'failed removing deployment workspace after error');
  assert.equal(warnings[0]?.metadata?.reason, 'post-run');
});

test('cleanupWorkspaceBestEffort warns and continues when deployment-error workspace cleanup fails', async (t) => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];

  t.mock.method(logger, 'warn', (message: string, metadata?: Record<string, unknown>) => {
    warnings.push({ message, metadata });
  });

  const runner = new DeploymentRunner() as unknown as {
    removeWorkspace: (workspaceDir: string) => Promise<void>;
    cleanupWorkspaceBestEffort: (input: {
      deploymentId: string;
      workspaceDir: string;
      reason: 'post-run' | 'deployment-error';
    }) => Promise<void>;
  };

  runner.removeWorkspace = async () => {
    throw new Error('EPERM: workspace locked');
  };

  await runner.cleanupWorkspaceBestEffort({
    deploymentId: 'dep-123',
    workspaceDir: 'workspace',
    reason: 'deployment-error'
  });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'failed removing deployment workspace after error');
  assert.equal(warnings[0]?.metadata?.reason, 'deployment-error');
});
