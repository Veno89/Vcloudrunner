import assert from 'node:assert/strict';
import test from 'node:test';

await import('./test/worker-test-env.js');

const { createConfiguredWorkerLifecycle } = await import('./configured-worker-lifecycle.factory.js');

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

test('createConfiguredWorkerLifecycle wires state service, runtime inspector, and scheduler', async () => {
  const logger = createLogger();
  const calls = {
    schedulerStart: 0,
    heartbeatPublish: 0,
    reconciliations: 0,
    inspectedContainers: [] as string[]
  };

  const lifecycle = createConfiguredWorkerLifecycle({
    logger,
    closeWorker: async () => undefined,
    createStateService: (() => ({
      async reconcileRunningDeployments(
        checkContainerRunning: (containerId: string) => Promise<boolean>
      ) {
        calls.reconciliations += 1;
        assert.equal(await checkContainerRunning('container-123'), true);
        return 0;
      }
    })) as never,
    createRuntimeInspector: (() => ({
      async isContainerRunning(containerId: string) {
        calls.inspectedContainers.push(containerId);
        return true;
      }
    })) as never,
    createScheduler: ((options: {
      logger: typeof logger;
      stateService: {
        reconcileRunningDeployments: (
          checkContainerRunning: (containerId: string) => Promise<boolean>
        ) => Promise<number>;
      };
    }) => {
      assert.equal(options.logger, logger);
      assert.equal(typeof options.stateService.reconcileRunningDeployments, 'function');

      return {
        start() {
          calls.schedulerStart += 1;
        },
        async stop() {},
        async publishHeartbeat() {
          calls.heartbeatPublish += 1;
        }
      };
    }) as never
  });

  lifecycle.handleReady();
  await flushAsyncWork();

  assert.equal(calls.schedulerStart, 1);
  assert.equal(calls.heartbeatPublish, 1);
  assert.equal(calls.reconciliations, 1);
  assert.deepEqual(calls.inspectedContainers, ['container-123']);
});
