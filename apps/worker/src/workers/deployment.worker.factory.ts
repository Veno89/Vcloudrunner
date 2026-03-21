import { Worker, type WorkerOptions } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { redisConnection } from '../queue/redis.js';
import { createDeploymentJobProcessor } from './deployment-job-processor.js';

type DeploymentWorkerProcessor = ReturnType<typeof createDeploymentJobProcessor>;

interface DeploymentWorkerConstructor {
  new (
    name: string,
    processor: DeploymentWorkerProcessor,
    opts: WorkerOptions
  ): Worker<DeploymentJobPayload>;
}

interface CreateDeploymentWorkerOptions {
  WorkerClass?: DeploymentWorkerConstructor;
  processor?: DeploymentWorkerProcessor;
  connection?: WorkerOptions['connection'];
  concurrency?: number;
}

export function createDeploymentWorker(options: CreateDeploymentWorkerOptions = {}) {
  const {
    WorkerClass = Worker as unknown as DeploymentWorkerConstructor,
    processor = createDeploymentJobProcessor(),
    connection = redisConnection,
    concurrency = 2
  } = options;

  return new WorkerClass(QUEUE_NAMES.deployment, processor, {
    connection,
    concurrency
  });
}
