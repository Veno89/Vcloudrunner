import { deploymentWorker } from './workers/deployment.worker.js';
import { logger } from './logger/logger.js';

deploymentWorker.on('ready', () => {
  logger.info('deployment worker ready');
});

deploymentWorker.on('completed', (job) => {
  logger.info('job completed', { jobId: job.id, deploymentId: job.data.deploymentId });
});

deploymentWorker.on('failed', (job, error) => {
  logger.error('job failed', {
    jobId: job?.id,
    deploymentId: job?.data.deploymentId,
    message: error.message
  });
});

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, async () => {
    logger.info(`received ${signal}, shutting down worker`);
    await deploymentWorker.close();
    process.exit(0);
  });
}
