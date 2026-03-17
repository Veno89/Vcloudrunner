import { Queue } from 'bullmq';
import { QUEUE_NAMES, type DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { redisConnection } from './redis.js';

type QueueLike = Pick<
  Queue<DeploymentJobPayload, unknown, 'deploy'>,
  'add' | 'getJobs' | 'getJob'
>;

export class DeploymentQueue {
  private readonly queue: QueueLike;

  constructor(queue?: QueueLike) {
    this.queue =
      queue ??
      new Queue<DeploymentJobPayload, unknown, 'deploy'>(QUEUE_NAMES.deployment, {
        connection: redisConnection
      });
  }

  enqueue(payload: DeploymentJobPayload) {
    return this.queue.add('deploy', payload, {
      jobId: payload.deploymentId,
      removeOnComplete: 100,
      removeOnFail: 1000,
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
  }

  async cancelQueuedDeployment(deploymentId: string) {
    let directMatch;
    try {
      directMatch = await this.queue.getJob(deploymentId);
    } catch {
      directMatch = undefined;
    }

    if (directMatch) {
      try {
        await directMatch.remove();
        return true;
      } catch {
        // Fall back to queue scan for compatibility with racey/legacy job states.
      }
    }

    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'paused', 'prioritized']);

    let removed = false;
    for (const job of jobs) {
      if (job.data.deploymentId !== deploymentId) {
        continue;
      }

      try {
        await job.remove();
        removed = true;
      } catch {
        // Continue scanning: another matching queued entry may still be removable.
      }
    }

    return removed;
  }
}
