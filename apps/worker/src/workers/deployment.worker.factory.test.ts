import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { QUEUE_NAMES } = await import('@vcloudrunner/shared-types');
const { createDeploymentWorker } = await import('./deployment.worker.factory.js');

test('createDeploymentWorker wires the deployment queue, processor, and worker options', () => {
  const processor = async () => undefined;
  const connection = { host: 'redis.example.test', port: 6379 } as const;

  class FakeWorker {
    constructor(
      public readonly name: string,
      public readonly handler: typeof processor,
      public readonly options: { connection: typeof connection; concurrency: number }
    ) {}
  }

  const worker = createDeploymentWorker({
    WorkerClass: FakeWorker as never,
    processor,
    connection,
    concurrency: 4
  }) as unknown as FakeWorker;

  assert.equal(worker.name, QUEUE_NAMES.deployment);
  assert.equal(worker.handler, processor);
  assert.deepEqual(worker.options, {
    connection,
    concurrency: 4
  });
});
