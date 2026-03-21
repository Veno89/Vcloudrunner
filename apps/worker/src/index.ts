import { logger } from './logger/logger.js';
import { createDeploymentStateService } from './services/deployment-state.service.factory.js';
import { createBackgroundScheduler } from './services/background-scheduler.factory.js';
import { createRuntimeInspector } from './services/runtime/runtime-inspector.factory.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { createWorkerLifecycle } from './bootstrap.js';

const stateService = createDeploymentStateService();
const runtimeInspector = createRuntimeInspector();
const scheduler = createBackgroundScheduler({ stateService, logger });
const lifecycle = createWorkerLifecycle({
  logger,
  scheduler,
  stateService,
  isContainerRunning: (containerId) => runtimeInspector.isContainerRunning(containerId),
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
