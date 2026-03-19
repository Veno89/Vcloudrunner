import { logger } from './logger/logger.js';
import { env } from './config/env.js';
import { DeploymentStateService } from './services/deployment-state.service.js';
import { BackgroundScheduler } from './services/background-scheduler.js';
import { deploymentWorker } from './workers/deployment.worker.js';
import { createWorkerLifecycle } from './bootstrap.js';
import { Redis } from 'ioredis';
import Docker from 'dockerode';

const stateService = new DeploymentStateService();
const docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
const heartbeatRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const scheduler = new BackgroundScheduler(stateService, heartbeatRedis, logger);
const lifecycle = createWorkerLifecycle({
  logger,
  scheduler,
  stateService,
  isContainerRunning: async (containerId) => {
    try {
      const info = await docker.getContainer(containerId).inspect();
      return info.State.Running === true;
    } catch {
      return false;
    }
  },
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
