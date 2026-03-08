import type { DeploymentJobPayload, DeploymentRuntimeConfig } from '@vcloudrunner/shared-types';

import { env } from '../../config/env.js';
import type { DbClient } from '../../db/client.js';
import { DeploymentQueue } from '../../queue/deployment-queue.js';
import { CryptoService } from '../../services/crypto.service.js';
import { EnvironmentRepository } from '../environment/environment.repository.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { DeploymentsRepository, type CreateDeploymentInput } from './deployments.repository.js';

export class DeploymentsService {
  private readonly deploymentsRepository: DeploymentsRepository;
  private readonly projectsRepository: ProjectsRepository;
  private readonly environmentRepository: EnvironmentRepository;
  private readonly cryptoService = new CryptoService();

  constructor(
    db: DbClient,
    private readonly deploymentQueue: DeploymentQueue
  ) {
    this.deploymentsRepository = new DeploymentsRepository(db);
    this.projectsRepository = new ProjectsRepository(db);
    this.environmentRepository = new EnvironmentRepository(db);
  }

  async createDeployment(input: CreateDeploymentInput) {
    const project = await this.projectsRepository.findById(input.projectId);
    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const runtime: DeploymentRuntimeConfig = {
      containerPort: input.runtime?.containerPort ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT,
      memoryMb: input.runtime?.memoryMb ?? env.DEPLOYMENT_DEFAULT_MEMORY_MB,
      cpuMillicores: input.runtime?.cpuMillicores ?? env.DEPLOYMENT_DEFAULT_CPU_MILLICORES
    };

    const deployment = await this.deploymentsRepository.create({
      ...input,
      metadata: {
        ...(input.metadata ?? {}),
        runtime
      }
    });

    const envVars = await this.environmentRepository.listByProject(project.id);

    const payload: DeploymentJobPayload = {
      deploymentId: deployment.id,
      projectId: project.id,
      projectSlug: project.slug,
      gitRepositoryUrl: project.gitRepositoryUrl,
      branch: input.branch ?? project.defaultBranch,
      commitSha: input.commitSha,
      env: Object.fromEntries(
        envVars.map((item) => [item.key, this.cryptoService.decrypt(item.encryptedValue)])
      ),
      runtime
    };

    const job = await this.deploymentQueue.enqueue(payload);

    return {
      ...deployment,
      queueJobId: job.id
    };
  }

  listDeployments(projectId: string) {
    return this.deploymentsRepository.findByProject(projectId);
  }
}
