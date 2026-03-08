import type { DbClient } from '../../db/client.js';
import { ProjectsRepository, type CreateProjectInput } from './projects.repository.js';

export class ProjectsService {
  private readonly repository: ProjectsRepository;

  constructor(db: DbClient) {
    this.repository = new ProjectsRepository(db);
  }

  createProject(input: CreateProjectInput) {
    return this.repository.create(input);
  }

  listProjectsByUser(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  getProjectById(projectId: string) {
    return this.repository.findById(projectId);
  }
}
