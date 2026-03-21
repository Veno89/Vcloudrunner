import { createDeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.factory.js';
import { createDeploymentLogArchiveUploader } from './archive-upload/deployment-log-archive-uploader.factory.js';
import type { DeploymentLogArchiveUploader } from './archive-upload/deployment-log-archive-uploader.js';
import type { DeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.js';
import { createDeploymentStateRepository } from './deployment-state.repository.factory.js';
import type { DeploymentStateRepository, Queryable } from './deployment-state.repository.js';
import { createIngressManager } from './ingress/ingress-manager.factory.js';
import type { IngressManager } from './ingress/ingress-manager.js';

interface CreateDeploymentStateServiceDependenciesOptions {
  pool?: Queryable;
  ingressManager?: Pick<IngressManager, 'deleteRoute'>;
  archiveUploader?: DeploymentLogArchiveUploader;
  archiveStore?: DeploymentLogArchiveStore;
}

export function createDeploymentStateServiceDependencies(
  options: CreateDeploymentStateServiceDependenciesOptions = {}
): {
  repository: DeploymentStateRepository;
  ingressManager: Pick<IngressManager, 'deleteRoute'>;
  archiveUploader: DeploymentLogArchiveUploader;
  archiveStore: DeploymentLogArchiveStore;
} {
  return {
    repository: createDeploymentStateRepository(options.pool),
    ingressManager: options.ingressManager ?? createIngressManager(),
    archiveUploader: options.archiveUploader ?? createDeploymentLogArchiveUploader(),
    archiveStore: options.archiveStore ?? createDeploymentLogArchiveStore()
  };
}
