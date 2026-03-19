import assert from 'node:assert/strict';
import test from 'node:test';

import './test/worker-test-env.js';

import { createWorkerLifecycle } from './bootstrap.js';

function createLogger() {
  return {
    infos: [] as Array<{ message: string; metadata?: Record<string, unknown> }>,
    warns: [] as Array<{ message: string; metadata?: Record<string, unknown> }>,
    errors: [] as Array<{ message: string; metadata?: Record<string, unknown> }>,
    info(message: string, metadata?: Record<string, unknown>) {
      this.infos.push({ message, metadata });
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      this.warns.push({ message, metadata });
    },
    error(message: string, metadata?: Record<string, unknown>) {
      this.errors.push({ message, metadata });
    }
  };
}

test('handleReady starts the scheduler and degrades gracefully when heartbeat and reconciliation fail', async () => {
  const logger = createLogger();
  let schedulerStarts = 0;
  let publishCalls = 0;
  let reconcileCalls = 0;

  const lifecycle = createWorkerLifecycle({
    logger,
    scheduler: {
      start() {
        schedulerStarts += 1;
      },
      async stop() {
        return undefined;
      },
      async publishHeartbeat() {
        publishCalls += 1;
        throw new Error('redis unavailable');
      }
    },
    stateService: {
      async reconcileRunningDeployments() {
        reconcileCalls += 1;
        throw new Error('db unavailable');
      }
    },
    isContainerRunning: async () => true,
    closeWorker: async () => undefined,
    exit: () => undefined
  });

  lifecycle.handleReady();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(schedulerStarts, 1);
  assert.equal(publishCalls, 1);
  assert.equal(reconcileCalls, 1);
  assert.equal(logger.infos[0]?.message, 'deployment worker ready');
  assert.equal(logger.warns[0]?.message, 'worker heartbeat publish failed');
  assert.equal(logger.errors[0]?.message, 'startup state reconciliation failed');
});

test('shutdown shares one cleanup path across repeated signals', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let stopCalls = 0;
  let closeCalls = 0;
  let releaseStop!: () => void;
  const stopWait = new Promise<void>((resolve) => {
    releaseStop = resolve;
  });

  const lifecycle = createWorkerLifecycle({
    logger,
    scheduler: {
      start() {},
      async stop() {
        stopCalls += 1;
        await stopWait;
      },
      async publishHeartbeat() {
        return undefined;
      }
    },
    stateService: {
      async reconcileRunningDeployments() {
        return 0;
      }
    },
    isContainerRunning: async () => true,
    closeWorker: async () => {
      closeCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    }
  });

  const firstShutdown = lifecycle.shutdown('SIGTERM');
  const secondShutdown = lifecycle.shutdown('SIGINT');

  releaseStop();
  await Promise.all([firstShutdown, secondShutdown]);

  assert.equal(stopCalls, 1);
  assert.equal(closeCalls, 1);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(logger.infos[0]?.message, 'received SIGTERM, shutting down worker');
  assert.equal(logger.infos.at(-1)?.message, 'worker shut down cleanly');
});

test('shutdown still attempts worker close and exits with failure when scheduler stop throws', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let closeCalls = 0;

  const lifecycle = createWorkerLifecycle({
    logger,
    scheduler: {
      start() {},
      async stop() {
        throw new Error('stop failed');
      },
      async publishHeartbeat() {
        return undefined;
      }
    },
    stateService: {
      async reconcileRunningDeployments() {
        return 0;
      }
    },
    isContainerRunning: async () => true,
    closeWorker: async () => {
      closeCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    }
  });

  await lifecycle.shutdown('SIGTERM');

  assert.equal(closeCalls, 1);
  assert.deepEqual(exitCodes, [1]);
  assert.equal(logger.errors[0]?.message, 'worker scheduler stop failed');
});
