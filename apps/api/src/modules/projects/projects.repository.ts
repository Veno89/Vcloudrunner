import { desc, eq, or } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { projectMembers, projects } from '../../db/schema.js';

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
    return this.db
      .selectDistinct({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        slug: projects.slug,
        gitRepositoryUrl: projects.gitRepositoryUrl,
        defaultBranch: projects.defaultBranch,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt
      })
      .from(projects)
      .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(or(
        eq(projects.userId, userId),
        eq(projectMembers.userId, userId)
      ))
      .orderBy(desc(projects.createdAt));
  }

  async findById(id: string) {
    return this.db.query.projects.findFirst({
      where: eq(projects.id, id)
    });
  }

  async checkMembership(projectId: string, userId: string) {
    const membership = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(or(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ))
      .limit(1);

    return membership.length > 0;
  }
}
