import { Worker } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { redisConnection } from '../queue/redis.js';
import { createDeploymentJobProcessor } from './deployment-job-processor.js';

export const deploymentWorker = new Worker<DeploymentJobPayload>(
  QUEUE_NAMES.deployment,
  createDeploymentJobProcessor(),
  {
    connection: redisConnection,
    concurrency: 2
  }
);
