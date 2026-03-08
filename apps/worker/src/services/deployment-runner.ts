import { mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import Docker from 'dockerode';
import type { DeploymentJobPayload } from '@vcloudrunner/shared-types';

import { env } from '../config/env.js';
import { logger } from '../logger/logger.js';

const execFileAsync = promisify(execFile);

export class DeploymentRunner {
  private readonly docker = new Docker({ socketPath: env.DOCKER_SOCKET_PATH });

  async run(job: DeploymentJobPayload) {
    const workspaceDir = join(env.WORK_DIR, job.deploymentId);
    const repoDir = join(workspaceDir, 'repo');
    const imageTag = `vcloudrunner/${job.projectSlug}:${job.deploymentId}`;
    const containerName = `vcloudrunner-${job.projectSlug}-${job.deploymentId.slice(0, 8)}`;

    const containerPort = job.runtime?.containerPort ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT;
    const memoryMb = job.runtime?.memoryMb ?? env.DEPLOYMENT_DEFAULT_MEMORY_MB;
    const cpuMillicores = job.runtime?.cpuMillicores ?? env.DEPLOYMENT_DEFAULT_CPU_MILLICORES;

    await rm(workspaceDir, { recursive: true, force: true });
    await mkdir(workspaceDir, { recursive: true });

    logger.info('cloning repository', { deploymentId: job.deploymentId });
    await execFileAsync('git', ['clone', '--depth', '1', '--branch', job.branch, job.gitRepositoryUrl, repoDir]);

    logger.info('building docker image', { imageTag });
    await execFileAsync('docker', ['build', '-t', imageTag, '.'], { cwd: repoDir });

    logger.info('starting container', { containerName, containerPort, memoryMb, cpuMillicores });

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
        RestartPolicy: { Name: 'unless-stopped' }
      }
    });

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
  }
}
