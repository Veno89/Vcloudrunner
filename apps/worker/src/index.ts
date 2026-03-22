import { logger } from './logger/logger.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { createConfiguredWorkerLifecycle } from './configured-worker-lifecycle.factory.js';

const lifecycle = createConfiguredWorkerLifecycle({
  logger,
  closeWorker: async () => {
    await deploymentWorker.close();
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

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, () => {
    void lifecycle.shutdown(signal);
  });
}
