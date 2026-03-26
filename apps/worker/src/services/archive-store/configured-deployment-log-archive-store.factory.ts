import { env } from '../../config/env.js';
import type { DeploymentLogArchiveStore } from './deployment-log-archive-store.js';
import { LocalDeploymentLogArchiveStore } from './local-deployment-log-archive-store.js';

export type DeploymentLogArchiveStoreConstructor = new (
  archiveDir: string
) => DeploymentLogArchiveStore;

export interface CreateConfiguredDeploymentLogArchiveStoreOptions {
  archiveDir?: string;
  StoreClass?: DeploymentLogArchiveStoreConstructor;
}

export function createConfiguredDeploymentLogArchiveStore(
  options: CreateConfiguredDeploymentLogArchiveStoreOptions = {}
): DeploymentLogArchiveStore {
  const StoreClass = options.StoreClass ?? LocalDeploymentLogArchiveStore;
  const archiveDir = options.archiveDir ?? env.DEPLOYMENT_LOG_ARCHIVE_DIR;

  return new StoreClass(archiveDir);
}
