import type { DbClient } from '../../db/client.js';

interface PostgresError {
  code?: string;
  constraint?: string;
}
import { ProjectsRepository, type CreateProjectInput } from './projects.repository.js';

export class ProjectsService {
  private readonly repository: ProjectsRepository;

  constructor(db: DbClient) {
    this.repository = new ProjectsRepository(db);
  }

  async createProject(input: CreateProjectInput) {
    try {
      return await this.repository.create(input);
    } catch (error) {
      const pgError = error as PostgresError;
      if (pgError.code === '23505' && pgError.constraint === 'projects_slug_unique') {
        throw new Error('PROJECT_SLUG_TAKEN');
      }

      throw error;
    }
  }

  listProjectsByUser(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  getProjectById(projectId: string) {
    return this.repository.findById(projectId);
  }
}
