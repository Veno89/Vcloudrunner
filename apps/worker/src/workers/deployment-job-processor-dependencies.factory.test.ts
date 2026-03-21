import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { createDeploymentJobProcessorDependencies } = await import('./deployment-job-processor-dependencies.factory.js');

test('createDeploymentJobProcessorDependencies wires the default processor dependencies through factory hooks', () => {
  const runtimeExecutor = {
    async run() {
      throw new Error('run should not be called during factory wiring');
    },
    async cleanupCancelledRun() {}
  };
  const stateService = {
    async isCancellationRequested() {
      return false;
    },
    async markStopped() {},
    async markBuilding() {},
    async appendLog() {},
    async markRunning() {},
    async markFailed() {}
  };
  const ingressManager = {
    async upsertRoute() {},
    async deleteRoute() {}
  };
  const eventSink = {
    emit() {}
  };
  const logger = {
    info() {},
    warn() {},
    error() {}
  };

  const dependencies = createDeploymentJobProcessorDependencies({
    createRuntimeExecutor: () => runtimeExecutor as never,
    createStateService: () => stateService as never,
    createIngressManager: () => ingressManager as never,
    createEventSink: () => eventSink as never,
    logger
  });

  assert.equal(dependencies.runtimeExecutor, runtimeExecutor);
  assert.equal(dependencies.stateService, stateService);
  assert.equal(dependencies.ingressManager, ingressManager);
  assert.equal(dependencies.eventSink, eventSink);
  assert.equal(dependencies.logger, logger);
});
