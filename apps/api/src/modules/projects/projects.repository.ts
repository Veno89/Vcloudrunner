import { eq } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { projects } from '../../db/schema.js';

export interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
}

export class ProjectsRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateProjectInput) {
    const [record] = await this.db.insert(projects).values({
      userId: input.userId,
      name: input.name,
      slug: input.slug,
      gitRepositoryUrl: input.gitRepositoryUrl,
      defaultBranch: input.defaultBranch ?? 'main'
    }).returning();

    return record;
  }

  async findAllByUser(userId: string) {
    return this.db.query.projects.findMany({
      where: eq(projects.userId, userId),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    });
  }

  async findById(id: string) {
    return this.db.query.projects.findFirst({
      where: eq(projects.id, id)
    });
  }
}
