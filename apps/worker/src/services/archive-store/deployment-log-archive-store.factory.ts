import type { DeploymentLogArchiveStore } from './deployment-log-archive-store.js';
import { LocalDeploymentLogArchiveStore } from './local-deployment-log-archive-store.js';

export function createDeploymentLogArchiveStore(): DeploymentLogArchiveStore {
  return new LocalDeploymentLogArchiveStore();
}
