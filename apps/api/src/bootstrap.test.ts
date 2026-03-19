import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

import { createApiLifecycle } from './bootstrap.js';

function createLogger() {
  return {
    infos: [] as unknown[][],
    errors: [] as unknown[][],
    info(...args: unknown[]) {
      this.infos.push(args);
    },
    error(...args: unknown[]) {
      this.errors.push(args);
    }
  };
}

test('start cleans up the app and telemetry when listen fails', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let closeCalls = 0;
  let shutdownCalls = 0;

  const lifecycle = createApiLifecycle({
    env: { HOST: '127.0.0.1', PORT: 4000 },
    buildServer: () => ({
      log: logger,
      async listen() {
        throw new Error('listen failed');
      },
      async close() {
        closeCalls += 1;
      }
    }),
    initTelemetry: async () => undefined,
    shutdownTelemetry: async () => {
      shutdownCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    }
  });

  await lifecycle.start();

  assert.equal(closeCalls, 1);
  assert.equal(shutdownCalls, 1);
  assert.deepEqual(exitCodes, [1]);
  assert.equal(logger.errors.length, 1);
  assert.equal(logger.errors[0][1], 'server failed to start');
});

test('start still shuts down telemetry when buildServer throws before returning an app', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let shutdownCalls = 0;

  const lifecycle = createApiLifecycle({
    env: { HOST: '127.0.0.1', PORT: 4000 },
    buildServer: () => {
      throw new Error('build failed');
    },
    initTelemetry: async () => undefined,
    shutdownTelemetry: async () => {
      shutdownCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    },
    logger
  });

  await lifecycle.start();

  assert.equal(shutdownCalls, 1);
  assert.deepEqual(exitCodes, [1]);
});

test('start still shuts down telemetry and exits when telemetry initialization fails', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let buildCalls = 0;
  let shutdownCalls = 0;

  const lifecycle = createApiLifecycle({
    env: { HOST: '127.0.0.1', PORT: 4000 },
    buildServer: () => {
      buildCalls += 1;
      return {
        log: logger,
        async listen() {
          return undefined;
        },
        async close() {
          return undefined;
        }
      };
    },
    initTelemetry: async () => {
      throw new Error('telemetry init failed');
    },
    shutdownTelemetry: async () => {
      shutdownCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    },
    logger
  });

  await lifecycle.start();

  assert.equal(buildCalls, 0);
  assert.equal(shutdownCalls, 1);
  assert.deepEqual(exitCodes, [1]);
  assert.equal(logger.errors.length, 1);
  assert.equal(logger.errors[0][1], 'server failed to start');
});

test('shutdown shares one cleanup path across repeated signals', async () => {
  const logger = createLogger();
  const exitCodes: number[] = [];
  let closeCalls = 0;
  let shutdownCalls = 0;
  let releaseClose!: () => void;
  const closeWait = new Promise<void>((resolve) => {
    releaseClose = resolve;
  });

  const lifecycle = createApiLifecycle({
    env: { HOST: '127.0.0.1', PORT: 4000 },
    buildServer: () => ({
      log: logger,
      async listen() {
        return undefined;
      },
      async close() {
        closeCalls += 1;
        await closeWait;
      }
    }),
    initTelemetry: async () => undefined,
    shutdownTelemetry: async () => {
      shutdownCalls += 1;
    },
    exit: (code) => {
      exitCodes.push(code);
    }
  });

  await lifecycle.start();

  const firstShutdown = lifecycle.shutdown('SIGTERM');
  const secondShutdown = lifecycle.shutdown('SIGINT');

  releaseClose();
  await Promise.all([firstShutdown, secondShutdown]);

  assert.equal(closeCalls, 1);
  assert.equal(shutdownCalls, 1);
  assert.deepEqual(exitCodes, [0]);
  assert.equal(logger.infos.length, 2);
  assert.equal(logger.infos[0][1], 'received shutdown signal, draining connections');
  assert.equal(logger.infos[1][0], 'server closed gracefully');
});
