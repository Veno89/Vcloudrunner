import { createDeploymentJobProcessor } from './deployment-job-processor.js';
import { createDeploymentWorker, type CreateDeploymentWorkerOptions } from './deployment.worker.factory.js';

export function createConfiguredDeploymentWorker(
  options: Omit<CreateDeploymentWorkerOptions, 'processor'> = {}
) {
  return createDeploymentWorker({
    ...options,
    processor: createDeploymentJobProcessor()
  });
}
