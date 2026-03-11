import { Queue } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { redisConnection } from './redis.js';

export class DeploymentQueue {
  private readonly queue = new Queue<DeploymentJobPayload, unknown, "deploy">(QUEUE_NAMES.deployment, {
    connection: redisConnection
  });

  enqueue(payload: DeploymentJobPayload) {
    return this.queue.add('deploy', payload, {
      removeOnComplete: 100,
      removeOnFail: 1000,
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }
}
