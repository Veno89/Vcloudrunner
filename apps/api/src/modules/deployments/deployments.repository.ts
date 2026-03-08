import { and, desc, eq } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { deployments } from '../../db/schema.js';

export interface CreateDeploymentInput {
  projectId: string;
  commitSha?: string;
  branch?: string;
  runtime?: {
    containerPort?: number;
    memoryMb?: number;
    cpuMillicores?: number;
  };
  metadata?: Record<string, unknown>;
}

export class DeploymentsRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateDeploymentInput) {
    const [record] = await this.db.insert(deployments).values({
      projectId: input.projectId,
      status: 'queued',
      commitSha: input.commitSha,
      branch: input.branch,
      metadata: input.metadata ?? {}
    }).returning();

    return record;
  }

  async findByProject(projectId: string) {
    return this.db.query.deployments.findMany({
      where: eq(deployments.projectId, projectId),
      orderBy: [desc(deployments.createdAt)]
    });
  }

  async findById(projectId: string, deploymentId: string) {
    return this.db.query.deployments.findFirst({
      where: and(
        eq(deployments.projectId, projectId),
        eq(deployments.id, deploymentId)
      )
    });
  }
}
