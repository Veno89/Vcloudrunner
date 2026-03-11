import { logger } from './logger/logger.js';
import { env } from './config/env.js';
import { DeploymentStateService } from './services/deployment-state.service.js';
import { deploymentWorker } from './workers/deployment.worker.js';

const retentionService = new DeploymentStateService();

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

const retentionInterval = setInterval(() => {
  void retentionService.pruneLogsByRetentionWindow().catch((error) => {
    logger.warn('deployment log retention prune failed', {
      message: error instanceof Error ? error.message : String(error)
    });
  });
}, env.DEPLOYMENT_LOG_PRUNE_INTERVAL_MS);

const archiveInterval = setInterval(() => {
  void retentionService.archiveEligibleDeploymentLogs()
    .then((archivedCount) => {
      if (archivedCount > 0) {
        logger.info('deployment log archive sweep completed', { archivedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS);

const archiveUploadInterval = setInterval(() => {
  void retentionService.uploadPendingArchives()
    .then((uploadedCount) => {
      if (uploadedCount > 0) {
        logger.info('deployment log archive upload sweep completed', { uploadedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive upload sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_UPLOAD_INTERVAL_MS);


const archiveCleanupInterval = setInterval(() => {
  void retentionService.cleanupArchivedArtifacts()
    .then((deletedCount) => {
      if (deletedCount > 0) {
        logger.info('deployment log archive cleanup sweep completed', { deletedCount });
      }
    })
    .catch((error) => {
      logger.warn('deployment log archive cleanup sweep failed', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
}, env.DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS);

const stopSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of stopSignals) {
  process.on(signal, async () => {
    logger.info(`received ${signal}, shutting down worker`);
    clearInterval(retentionInterval);
    clearInterval(archiveInterval);
    clearInterval(archiveUploadInterval);
    clearInterval(archiveCleanupInterval);
    await deploymentWorker.close();
    process.exit(0);
  });
}
