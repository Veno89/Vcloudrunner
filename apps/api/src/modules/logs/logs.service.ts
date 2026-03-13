import type { DbClient } from '../../db/client.js';
import { DeploymentNotFoundError, ProjectNotFoundError } from '../../server/domain-errors.js';
import { DeploymentsRepository } from '../deployments/deployments.repository.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { LogsRepository } from './logs.repository.js';

export class LogsService {
  private readonly logsRepository: LogsRepository;
  private readonly projectsRepository: ProjectsRepository;
  private readonly deploymentsRepository: DeploymentsRepository;

  constructor(db: DbClient) {
    this.logsRepository = new LogsRepository(db);
    this.projectsRepository = new ProjectsRepository(db);
    this.deploymentsRepository = new DeploymentsRepository(db);
  }

  async list(projectId: string, deploymentId: string, after: string | undefined, limit: number) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const deployment = await this.deploymentsRepository.findById(projectId, deploymentId);
    if (!deployment) {
      throw new DeploymentNotFoundError();
    }

    return this.logsRepository.listByDeployment({ deploymentId, after, limit });
  }

  async export(projectId: string, deploymentId: string, from?: string, to?: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const deployment = await this.deploymentsRepository.findById(projectId, deploymentId);
    if (!deployment) {
      throw new DeploymentNotFoundError();
    }

    return this.logsRepository.listForExport({ deploymentId, from, to });
  }
}
