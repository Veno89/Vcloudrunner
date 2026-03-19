import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import type { DeploymentJobPayload } from '@vcloudrunner/shared-types';
import Docker from 'dockerode';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { DeploymentFailure } from '../workers/deployment-errors.js';
import { detectBuildSystem } from './build-detection/index.js';

const execFileAsync = promisify(execFile);

export class DeploymentRunner {
  private readonly docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });
  private networkEnsured = false;

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

  private async ensureDeploymentNetwork(): Promise<string> {
    const networkName = env.DEPLOYMENT_NETWORK_NAME;
    if (this.networkEnsured) return networkName;

    const networks = await this.docker.listNetworks({ filters: { name: [networkName] } });
    const exact = networks.find((network: { Name?: string }) => network.Name === networkName);
    if (!exact) {
      try {
        await this.docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          Internal: false,
          Labels: { 'managed-by': 'vcloudrunner' },
        });
        logger.info('created deployment network', { networkName });
      } catch (error) {
        if (!this.isNetworkAlreadyExistsError(error)) {
          throw error;
        }

        const refreshedNetworks = await this.docker.listNetworks({
          filters: { name: [networkName] }
        });
        const refreshedExact = refreshedNetworks.find(
          (network: { Name?: string }) => network.Name === networkName
        );

        if (!refreshedExact) {
          throw error;
        }
      }
    }
    this.networkEnsured = true;
    return networkName;
  }

  async run(job: DeploymentJobPayload) {
    const workspaceDir = join(env.WORK_DIR, job.deploymentId);
    const repoDir = join(workspaceDir, 'repo');
    const imageTag = `vcloudrunner/${job.projectSlug}:${job.deploymentId}`;
    const containerName = `vcloudrunner-${job.projectSlug}-${job.deploymentId.slice(0, 8)}`;

    const containerPort = job.runtime?.containerPort ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT;
    const memoryMb = job.runtime?.memoryMb ?? env.DEPLOYMENT_DEFAULT_MEMORY_MB;
    const cpuMillicores = job.runtime?.cpuMillicores ?? env.DEPLOYMENT_DEFAULT_CPU_MILLICORES;

    let createdContainerId: string | null = null;
    let imageBuilt = false;

    await rm(workspaceDir, { recursive: true, force: true });
    await mkdir(workspaceDir, { recursive: true });

    try {
      await this.removeContainerByName(containerName);

      logger.info('cloning repository', { deploymentId: job.deploymentId });
      await execFileAsync('git', ['clone', '--depth', '1', '--branch', job.branch, job.gitRepositoryUrl, repoDir]);

      const buildResult = await detectBuildSystem(repoDir);
      if (!buildResult) {
        throw new DeploymentFailure(
          'DEPLOYMENT_DOCKERFILE_NOT_FOUND',
          'DEPLOYMENT_DOCKERFILE_NOT_FOUND: no Dockerfile found in repository root or common subpaths',
          false
        );
      }
      const dockerfilePath = buildResult.buildFilePath;

      logger.info('building docker image', { imageTag, dockerfilePath });
      await execFileAsync('docker', ['build', '-f', dockerfilePath, '-t', imageTag, '.'], { cwd: repoDir });
      imageBuilt = true;

      logger.info('starting container', { containerName, containerPort, memoryMb, cpuMillicores });

      const networkName = await this.ensureDeploymentNetwork();
      const exposedPort = `${containerPort}/tcp`;
      const container = await this.docker.createContainer({
        name: containerName,
        Image: imageTag,
        User: '1000:1000',
        Env: Object.entries(job.env).map(([key, value]) => `${key}=${value}`),
        ExposedPorts: { [exposedPort]: {} },
        HostConfig: {
          PublishAllPorts: true,
          Memory: memoryMb * 1024 * 1024,
          NanoCpus: cpuMillicores * 1_000_000,
          PidsLimit: 256,
          ReadonlyRootfs: false,
          RestartPolicy: { Name: 'unless-stopped' },
          NetworkMode: networkName
        }
      });

      createdContainerId = container.id;

      await container.start();
      const inspected = await container.inspect();
      const hostPort = inspected.NetworkSettings.Ports[exposedPort]?.[0]?.HostPort;

      return {
        containerId: inspected.Id,
        containerName,
        imageTag,
        hostPort: hostPort ? Number(hostPort) : null,
        runtimeUrl: hostPort ? `http://${job.projectSlug}.${env.PLATFORM_DOMAIN}` : null,
        internalPort: containerPort,
        projectPath: basename(repoDir)
      };
    } catch (error) {
      await this.cleanupFailedRun({
        containerId: createdContainerId,
        imageTag: imageBuilt ? imageTag : null,
        workspaceDir,
        deploymentId: job.deploymentId
      });
      throw error;
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }
  }

  async cleanupCancelledRun(input: {
    deploymentId: string;
    containerId: string;
    imageTag: string;
  }) {
    try {
      await this.docker.getContainer(input.containerId).remove({ force: true });
    } catch (error) {
      logger.warn('failed removing container after cancellation', {
        deploymentId: input.deploymentId,
        containerId: input.containerId,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await execFileAsync('docker', ['image', 'rm', '-f', input.imageTag]);
    } catch (error) {
      logger.warn('failed removing image after cancellation', {
        deploymentId: input.deploymentId,
        imageTag: input.imageTag,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async removeContainerByName(containerName: string) {
    try {
      const matches = await this.docker.listContainers({ all: true, filters: { name: [containerName] } });

      if (matches.length === 0) {
        return;
      }

      let removedCount = 0;

      for (const item of matches) {
        const container = this.docker.getContainer(item.Id);
        try {
          if (item.State === 'running') {
            await container.stop({ t: 10 });
          }
        } catch (error) {
          logger.warn('failed stopping stale container before retry', {
            containerName,
            containerId: item.Id,
            message: error instanceof Error ? error.message : String(error)
          });
        }

        try {
          await container.remove({ force: true });
          removedCount += 1;
        } catch (error) {
          logger.warn('failed removing stale container before retry', {
            containerName,
            containerId: item.Id,
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
    workspaceDir: string;
  }) {
    if (input.containerId) {
      try {
        await this.docker.getContainer(input.containerId).remove({ force: true });
      } catch (error) {
        logger.warn('failed removing container after deployment error', {
          deploymentId: input.deploymentId,
          containerId: input.containerId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (input.imageTag) {
      try {
        await execFileAsync('docker', ['image', 'rm', '-f', input.imageTag]);
      } catch (error) {
        logger.warn('failed removing image after deployment error', {
          deploymentId: input.deploymentId,
          imageTag: input.imageTag,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    try {
      await rm(input.workspaceDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn('failed removing deployment workspace after error', {
        deploymentId: input.deploymentId,
        workspaceDir: input.workspaceDir,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
