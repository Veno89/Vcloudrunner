import { and, desc, eq } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { deploymentLogs, deployments } from '../../db/schema.js';

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

  async markCancellationRequested(input: {
    deploymentId: string;
    metadata: Record<string, unknown>;
    requestedByCorrelationId: string;
  }) {
    const nextMetadata = {
      ...input.metadata,
      cancellation: {
        requestedAt: new Date().toISOString(),
        requestedByCorrelationId: input.requestedByCorrelationId
      }
    } satisfies Record<string, unknown>;

    await this.db.update(deployments).set({
      metadata: nextMetadata,
      updatedAt: new Date()
    }).where(eq(deployments.id, input.deploymentId));
  }

  async markStopped(deploymentId: string) {
    await this.db.update(deployments).set({
      status: 'stopped',
      finishedAt: new Date(),
      runtimeUrl: null,
      updatedAt: new Date()
    }).where(eq(deployments.id, deploymentId));
  }

  async appendLog(input: { deploymentId: string; level: 'info' | 'warn' | 'error'; message: string }) {
    await this.db.insert(deploymentLogs).values({
      deploymentId: input.deploymentId,
      level: input.level,
      message: input.message.slice(0, 10000)
    });
  }
}
