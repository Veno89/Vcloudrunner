import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { logger } = await import('../logger/logger.js');
const { DeploymentRunner } = await import('./deployment-runner.js');

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
