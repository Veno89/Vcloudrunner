import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import {
  containers,
  deploymentLogs,
  deployments,
  domains,
  environmentVariables,
  projectMembers,
  projects
} from '../../db/schema.js';

import type {
  CreateProjectInput,
  ProjectActiveDeploymentRecord,
  UpdateProjectInput
} from './projects.repository.types.js';

// Re-export all types for backward compatibility
export type {
  ProjectDomainEventKind,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectMemberRecord,
  ProjectInvitationRecord,
  ProjectInvitationClaimRecord,
  ProjectDomainRecord,
  ProjectDomainEventRecord,
  ProjectActiveDeploymentRecord,
  CreateProjectDomainInput,
  CreateProjectDomainEventInput,
  UpdateProjectDomainDiagnosticsInput
} from './projects.repository.types.js';

// Re-export sub-repository classes for consumers that import from this barrel
export { ProjectDomainsRepository } from './project-domains.repository.js';
export { ProjectMembersRepository } from './project-members.repository.js';

export class ProjectsRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateProjectInput) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx.insert(projects).values({
        userId: input.userId,
        name: input.name,
        slug: input.slug,
        gitRepositoryUrl: input.gitRepositoryUrl,
        defaultBranch: input.defaultBranch ?? 'main',
        ...(input.services ? { services: input.services } : {}),
        ...(input.githubInstallationId ? { githubInstallationId: input.githubInstallationId } : {})
      }).returning();

      await tx.insert(projectMembers).values({
        projectId: record.id,
        userId: input.userId,
        role: 'admin'
      });

      return record;
    });
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
        services: projects.services,
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

  async updateProject(id: string, input: UpdateProjectInput) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.gitRepositoryUrl !== undefined) values.gitRepositoryUrl = input.gitRepositoryUrl;
    if (input.defaultBranch !== undefined) values.defaultBranch = input.defaultBranch;
    if (input.services !== undefined) values.services = input.services;

    const [updated] = await this.db
      .update(projects)
      .set(values)
      .where(eq(projects.id, id))
      .returning();

    return updated ?? null;
  }

  async listActiveDeployments(projectId: string): Promise<ProjectActiveDeploymentRecord[]> {
    return this.db
      .select({
        id: deployments.id,
        projectId: deployments.projectId,
        serviceName: deployments.serviceName,
        status: deployments.status
      })
      .from(deployments)
      .where(and(
        eq(deployments.projectId, projectId),
        inArray(deployments.status, ['queued', 'building', 'running'])
      ))
      .orderBy(asc(deployments.createdAt)) as Promise<ProjectActiveDeploymentRecord[]>;
  }

  async deleteProject(projectId: string) {
    return this.db.transaction(async (tx) => {
      const projectDeployments = await tx
        .select({
          id: deployments.id
        })
        .from(deployments)
        .where(eq(deployments.projectId, projectId));
      const deploymentIds = projectDeployments.map((deployment) => deployment.id);

      await tx
        .delete(domains)
        .where(eq(domains.projectId, projectId));

      await tx
        .delete(environmentVariables)
        .where(eq(environmentVariables.projectId, projectId));

      if (deploymentIds.length > 0) {
        await tx
          .delete(deploymentLogs)
          .where(inArray(deploymentLogs.deploymentId, deploymentIds));

        await tx
          .delete(containers)
          .where(inArray(containers.deploymentId, deploymentIds));

        await tx
          .delete(deployments)
          .where(eq(deployments.projectId, projectId));
      }

      const [deletedProject] = await tx
        .delete(projects)
        .where(eq(projects.id, projectId))
        .returning({
          id: projects.id
        });

      return deletedProject ?? null;
    });
  }
}
