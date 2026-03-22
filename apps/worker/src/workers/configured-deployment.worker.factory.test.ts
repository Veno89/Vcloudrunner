import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { createConfiguredDeploymentWorker } = await import('./configured-deployment.worker.factory.js');

test('createConfiguredDeploymentWorker returns the configured worker implementation', () => {
  const worker = createConfiguredDeploymentWorker({
    WorkerClass: class FakeWorker {
      constructor(
        public readonly name: string,
        public readonly handler: unknown,
        public readonly options: unknown
      ) {}
    } as never
  }) as unknown as { name: string; handler: unknown; options: unknown };

  assert.equal(typeof worker.name, 'string');
  assert.equal(typeof worker.handler, 'function');
  assert.ok(worker.options);
});
