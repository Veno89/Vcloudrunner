import { createDeploymentLogArchiveBuilder } from './archive-build/deployment-log-archive-builder.factory.js';
import type { DeploymentLogArchiveBuilder } from './archive-build/deployment-log-archive-builder.js';
import { createDeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.factory.js';
import { createDeploymentLogArchiveUploader } from './archive-upload/deployment-log-archive-uploader.factory.js';
import type { DeploymentLogArchiveUploader } from './archive-upload/deployment-log-archive-uploader.js';
import type { DeploymentLogArchiveStore } from './archive-store/deployment-log-archive-store.js';
import { createDeploymentStateRepository } from './deployment-state.repository.factory.js';
import type { Queryable } from './deployment-state.repository.js';
import { createIngressManager } from './ingress/ingress-manager.factory.js';
import type { IngressManager } from './ingress/ingress-manager.js';
import type { DeploymentStateServiceDependencies } from './deployment-state.service.js';

export interface CreateDeploymentStateServiceDependenciesOptions {
  pool?: Queryable;
  ingressManager?: Pick<IngressManager, 'deleteRoute'>;
  archiveUploader?: DeploymentLogArchiveUploader;
  archiveStore?: DeploymentLogArchiveStore;
  archiveBuilder?: DeploymentLogArchiveBuilder;
}

export function createDeploymentStateServiceDependencies(
  options: CreateDeploymentStateServiceDependenciesOptions = {}
): DeploymentStateServiceDependencies {
  return {
    repository: createDeploymentStateRepository(options.pool),
    ingressManager: options.ingressManager ?? createIngressManager(),
    archiveUploader: options.archiveUploader ?? createDeploymentLogArchiveUploader(),
    archiveStore: options.archiveStore ?? createDeploymentLogArchiveStore(),
    archiveBuilder: options.archiveBuilder ?? createDeploymentLogArchiveBuilder()
  };
}
