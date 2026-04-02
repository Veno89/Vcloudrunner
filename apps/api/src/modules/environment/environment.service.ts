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

  async exportAsEnvFile(projectId: string): Promise<string> {
    const entries = await this.list(projectId);
    return entries
      .map((entry) => `${entry.key}=${this.formatEnvValue(entry.value)}`)
      .join('\n');
  }

  async importFromEnvFile(projectId: string, content: string): Promise<{ imported: number; skipped: number }> {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const lines = content.split(/\r?\n/);
    let imported = 0;
    let skipped = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith('#')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex < 1) {
        skipped++;
        continue;
      }

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1);

      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!/^[A-Z0-9_]+$/.test(key)) {
        skipped++;
        continue;
      }

      const encryptedValue = this.cryptoService.encrypt(value);
      await this.environmentRepository.upsert({ projectId, key, encryptedValue });
      imported++;
    }

    return { imported, skipped };
  }

  private formatEnvValue(value: string): string {
    if (/[\s#"'\\]/.test(value) || value.length === 0) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }
}
