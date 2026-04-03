import {
  buildProjectServiceInternalHostname,
  isPublicWebServiceTarget,
  type DeploymentJobPayload
} from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { normalizeDeploymentSourceRoot } from './deployment-source-root.js';
import type { ContainerRuntimeManager } from './runtime/container-runtime-manager.js';
import type { DeploymentImageBuilder } from './runtime/deployment-image-builder.js';
import type {
  DeploymentWorkspaceManager,
  PreparedDeploymentWorkspace
} from './runtime/deployment-workspace-manager.js';

export class DeploymentRunner {
  constructor(
    private readonly workspaceManager: DeploymentWorkspaceManager,
    private readonly imageBuilder: DeploymentImageBuilder,
    private readonly runtimeManager: ContainerRuntimeManager
  ) {}

  private networkEnsured = false;

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private isNetworkAlreadyExistsError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const statusCode = (error as unknown as { statusCode?: unknown }).statusCode;

    return (
      (typeof statusCode === 'number' && statusCode === 409) ||
      /already exists/i.test(error.message)
    );
  }

  private isCleanupResourceMissingError(error: unknown, resource: 'container' | 'image'): boolean {
    const statusCode = (error as unknown as { statusCode?: unknown }).statusCode;
    const message = this.getErrorMessage(error);

    if (typeof statusCode === 'number' && statusCode === 404) {
      return true;
    }

    return resource === 'container'
      ? /no such container/i.test(message)
      : /no such image/i.test(message);
  }

  private async removeContainerForce(containerId: string) {
    await this.runtimeManager.removeContainer(containerId);
  }

  private async removeImageForce(imageTag: string) {
    await this.imageBuilder.removeImage(imageTag);
  }

  private async prepareWorkspace(
    deploymentId: string,
    sourceRoot?: string | null
  ): Promise<PreparedDeploymentWorkspace> {
    return this.workspaceManager.prepareWorkspace(deploymentId, { sourceRoot });
  }

  private async removeWorkspace(workspaceDir: string) {
    await this.workspaceManager.cleanupWorkspace(workspaceDir);
  }

  private async cleanupWorkspaceBestEffort(input: {
    deploymentId: string;
    workspaceDir: string;
    reason: 'post-run' | 'deployment-error';
  }) {
    try {
      await this.removeWorkspace(input.workspaceDir);
    } catch (error) {
      logger.warn('failed removing deployment workspace after error', {
        deploymentId: input.deploymentId,
        workspaceDir: input.workspaceDir,
        reason: input.reason,
        message: this.getErrorMessage(error)
      });
    }
  }

  private async ensureDeploymentNetwork(): Promise<string> {
    const networkName = env.DEPLOYMENT_NETWORK_NAME;
    if (this.networkEnsured) return networkName;

    const networks = await this.runtimeManager.listNetworksByName(networkName);
    const exact = networks.find((network) => network.name === networkName);
    if (!exact) {
      try {
        await this.runtimeManager.createNetwork(networkName);
        logger.info('created deployment network', { networkName });
      } catch (error) {
        if (!this.isNetworkAlreadyExistsError(error)) {
          throw error;
        }

        const refreshedNetworks = await this.runtimeManager.listNetworksByName(networkName);
        const refreshedExact = refreshedNetworks.find((network) => network.name === networkName);

        if (!refreshedExact) {
          throw error;
        }
      }
    }
    this.networkEnsured = true;
    return networkName;
  }

  async run(job: DeploymentJobPayload) {
    const sourceRoot = normalizeDeploymentSourceRoot(job.serviceSourceRoot);
    const shouldPublishPort = isPublicWebServiceTarget({
      kind: job.serviceKind,
      exposure: job.serviceExposure
    });
    const workspace = await this.prepareWorkspace(job.deploymentId, sourceRoot);
    const imageTag = `vcloudrunner/${job.projectSlug}:${job.deploymentId}`;
    const containerName = `vcloudrunner-${job.projectSlug}-${job.deploymentId.slice(0, 8)}`;
    const serviceHostname = buildProjectServiceInternalHostname(
      job.projectSlug,
      job.serviceName ?? 'app'
    );
    const additionalNetworkNames = env.PLATFORM_DOCKER_NETWORK_NAME.trim().length > 0
      ? [env.PLATFORM_DOCKER_NETWORK_NAME.trim()]
      : [];

    const containerPort = job.runtime?.containerPort ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT;
    const memoryMb = job.runtime?.memoryMb ?? env.DEPLOYMENT_DEFAULT_MEMORY_MB;
    const cpuMillicores = job.runtime?.cpuMillicores ?? env.DEPLOYMENT_DEFAULT_CPU_MILLICORES;

    let createdContainerId: string | null = null;
    let imageBuilt = false;

    try {
      await this.removeContainerByName(containerName);

      await this.imageBuilder.buildRuntimeImage({
        deploymentId: job.deploymentId,
        gitRepositoryUrl: job.gitRepositoryUrl,
        branch: job.branch,
        repoDir: workspace.repoDir,
        imageTag,
        sourceRoot,
        gitAccessToken: job.gitAccessToken
      });
      imageBuilt = true;

      logger.info('starting container', {
        containerName,
        containerPort,
        memoryMb,
        cpuMillicores,
        serviceName: job.serviceName ?? null,
        serviceSourceRoot: sourceRoot
      });

      const networkName = await this.ensureDeploymentNetwork();
      const startResult = await this.runtimeManager.startContainer({
        name: containerName,
        imageTag,
        env: job.env,
        networkName,
        networkAliases: [serviceHostname],
        additionalNetworkNames,
        containerPort,
        publishPort: shouldPublishPort,
        memoryMb,
        cpuMillicores,
        healthCheck: job.runtime?.healthCheck,
        restartPolicy: job.runtime?.restartPolicy
      });
      createdContainerId = startResult.containerId;

      return {
        containerId: startResult.containerId,
        containerName,
        imageTag,
        hostPort: startResult.hostPort,
        runtimeUrl:
          shouldPublishPort && startResult.hostPort
            ? `http://${job.projectSlug}.${env.PLATFORM_DOMAIN}`
            : null,
        internalPort: containerPort,
        projectPath: workspace.projectPath
      };
    } catch (error) {
      await this.cleanupFailedRun({
        containerId: createdContainerId,
        imageTag: imageBuilt ? imageTag : null,
        deploymentId: job.deploymentId,
        originalError: error
      });
      throw error;
    } finally {
      await this.cleanupWorkspaceBestEffort({
        deploymentId: job.deploymentId,
        workspaceDir: workspace.workspaceDir,
        reason: 'post-run'
      });
    }
  }

  async cleanupCancelledRun(input: {
    deploymentId: string;
    containerId: string;
    imageTag: string;
  }) {
    const failures: string[] = [];

    try {
      await this.removeContainerForce(input.containerId);
    } catch (error) {
      if (!this.isCleanupResourceMissingError(error, 'container')) {
        logger.warn('failed removing container after cancellation', {
          deploymentId: input.deploymentId,
          containerId: input.containerId,
          message: this.getErrorMessage(error)
        });
        failures.push(`container remove failed: ${this.getErrorMessage(error)}`);
      }
    }

    try {
      await this.removeImageForce(input.imageTag);
    } catch (error) {
      if (!this.isCleanupResourceMissingError(error, 'image')) {
        logger.warn('failed removing image after cancellation', {
          deploymentId: input.deploymentId,
          imageTag: input.imageTag,
          message: this.getErrorMessage(error)
        });
        failures.push(`image remove failed: ${this.getErrorMessage(error)}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`deployment runtime cleanup incomplete: ${failures.join('; ')}`);
    }
  }

  private async removeContainerByName(containerName: string) {
    try {
      const matches = await this.runtimeManager.listContainersByName(containerName);

      if (matches.length === 0) {
        return;
      }

      let removedCount = 0;

      for (const item of matches) {
        try {
          if (item.state === 'running') {
            await this.runtimeManager.stopContainer(item.id);
          }
        } catch (error) {
          logger.warn('failed stopping stale container before retry', {
            containerName,
            containerId: item.id,
            message: error instanceof Error ? error.message : String(error)
          });
        }

        try {
          await this.runtimeManager.removeContainer(item.id);
          removedCount += 1;
        } catch (error) {
          logger.warn('failed removing stale container before retry', {
            containerName,
            containerId: item.id,
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (removedCount > 0) {
        logger.info('removed stale deployment container before run', { containerName, removedCount });
      }
    } catch (error) {
      logger.warn('failed to remove stale container before run', {
        containerName,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async cleanupFailedRun(input: {
    deploymentId: string;
    containerId: string | null;
    imageTag: string | null;
    originalError: unknown;
  }) {
    const failures: string[] = [];

    if (input.containerId) {
      try {
        await this.removeContainerForce(input.containerId);
      } catch (error) {
        if (!this.isCleanupResourceMissingError(error, 'container')) {
          logger.warn('failed removing container after deployment error', {
            deploymentId: input.deploymentId,
            containerId: input.containerId,
            message: this.getErrorMessage(error)
          });
          failures.push(`container remove failed: ${this.getErrorMessage(error)}`);
        }
      }
    }

    if (input.imageTag) {
      try {
        await this.removeImageForce(input.imageTag);
      } catch (error) {
        if (!this.isCleanupResourceMissingError(error, 'image')) {
          logger.warn('failed removing image after deployment error', {
            deploymentId: input.deploymentId,
            imageTag: input.imageTag,
            message: this.getErrorMessage(error)
          });
          failures.push(`image remove failed: ${this.getErrorMessage(error)}`);
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${this.getErrorMessage(input.originalError)} (deployment failure cleanup incomplete: ${failures.join('; ')})`
      );
    }
  }
}
