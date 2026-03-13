import type { DbClient } from '../../db/client.js';
import { EnvironmentVariableNotFoundError, ProjectNotFoundError } from '../../server/domain-errors.js';
import { CryptoService } from '../../services/crypto.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { EnvironmentRepository } from './environment.repository.js';

export class EnvironmentService {
  private readonly projectsRepository: ProjectsRepository;
  private readonly environmentRepository: EnvironmentRepository;
  private readonly cryptoService = new CryptoService();

  constructor(db: DbClient) {
    this.projectsRepository = new ProjectsRepository(db);
    this.environmentRepository = new EnvironmentRepository(db);
  }

  async list(projectId: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const entries = await this.environmentRepository.listByProject(projectId);

    return entries.map((entry) => ({
      id: entry.id,
      key: entry.key,
      value: this.cryptoService.decrypt(entry.encryptedValue),
      updatedAt: entry.updatedAt
    }));
  }

  async upsert(projectId: string, key: string, value: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const encryptedValue = this.cryptoService.encrypt(value);
    return this.environmentRepository.upsert({ projectId, key, encryptedValue });
  }

  async remove(projectId: string, key: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const removed = await this.environmentRepository.delete(projectId, key);
    if (!removed) {
      throw new EnvironmentVariableNotFoundError();
    }

    return removed;
  }

  decrypt(encryptedValue: string) {
    return this.cryptoService.decrypt(encryptedValue);
  }
}
