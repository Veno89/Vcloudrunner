import { Worker, type WorkerOptions } from 'bullmq';
import { QUEUE_NAMES, type DeploymentStopJobPayload } from '@vcloudrunner/shared-types';

import { createRedisConnection } from '../queue/redis-connection.factory.js';
import { createStopJobProcessor } from './stop-job-processor.js';

type StopWorkerProcessor = ReturnType<typeof createStopJobProcessor>;

interface StopWorkerConstructor {
  new (
    name: string,
    processor: StopWorkerProcessor,
    opts: WorkerOptions
  ): Worker<DeploymentStopJobPayload>;
}

export interface CreateStopWorkerOptions {
  WorkerClass?: StopWorkerConstructor;
  processor?: StopWorkerProcessor;
  connection?: WorkerOptions['connection'];
  concurrency?: number;
}

export function createStopWorker(options: CreateStopWorkerOptions = {}) {
  const {
    WorkerClass = Worker as unknown as StopWorkerConstructor,
    processor = createStopJobProcessor(),
    connection,
    concurrency = 2,
  } = options;

  return new WorkerClass(QUEUE_NAMES.deploymentStop, processor, {
    connection: connection ?? createRedisConnection(),
    concurrency,
  });
}
