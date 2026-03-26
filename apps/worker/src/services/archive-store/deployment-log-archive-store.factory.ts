import {
  createConfiguredDeploymentLogArchiveStore,
  type CreateConfiguredDeploymentLogArchiveStoreOptions
} from './configured-deployment-log-archive-store.factory.js';
import type { DeploymentLogArchiveStore } from './deployment-log-archive-store.js';

export function createDeploymentLogArchiveStore(
  options: CreateConfiguredDeploymentLogArchiveStoreOptions = {}
): DeploymentLogArchiveStore {
  return createConfiguredDeploymentLogArchiveStore(options);
}
