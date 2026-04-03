import { logger } from './logger/logger.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { createStopWorker } from './workers/stop.worker.factory.js';
import { createConfiguredWorkerLifecycle } from './configured-worker-lifecycle.factory.js';

const stopWorker = createStopWorker();

const lifecycle = createConfiguredWorkerLifecycle({
  logger,
  closeWorker: async () => {
    await deploymentWorker.close();
    await stopWorker.close();
  }
});

deploymentWorker.on('ready', () => {
  lifecycle.handleReady();
});

deploymentWorker.on('completed', (job) => {
  lifecycle.handleCompleted(job);
});

deploymentWorker.on('failed', (job, error) => {
  lifecycle.handleFailed(job, error);
});

stopWorker.on('ready', () => {
  logger.info('stop worker ready');
});

stopWorker.on('completed', (job) => {
  logger.info('stop job completed', {
    jobId: job.id,
    deploymentId: job.data.deploymentId,
  });
});

stopWorker.on('failed', (job, error) => {
  logger.error('stop job failed', {
    jobId: job?.id,
    deploymentId: job?.data.deploymentId,
    message: error.message,
  });
});

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, () => {
    void lifecycle.shutdown(signal);
  });
}
