import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { deploymentLogs, deployments, projects } from '../../db/schema.js';

export interface CreateDeploymentInput {
  projectId: string;
  serviceName?: string;
  commitSha?: string;
  branch?: string;
  runtime?: {
    containerPort?: number;
    memoryMb?: number;
    cpuMillicores?: number;
    healthCheck?: {
      command: string;
      intervalSeconds: number;
      timeoutSeconds: number;
      retries: number;
      startPeriodSeconds: number;
    };
    restartPolicy?: string;
  };
  metadata?: Record<string, unknown>;
}

type ResolvedCreateDeploymentInput = CreateDeploymentInput & {
  serviceName: string;
};

export class DeploymentsRepository {
  constructor(private readonly db: DbClient) {}

  async createIfNoActiveDeployment(input: ResolvedCreateDeploymentInput) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        select ${projects.id}
        from ${projects}
        where ${projects.id} = ${input.projectId}
        for update
      `);

      const activeDeployment = await tx.query.deployments.findFirst({
        where: and(
          eq(deployments.projectId, input.projectId),
          eq(deployments.serviceName, input.serviceName),
          inArray(deployments.status, ['queued', 'building', 'running'])
        ),
        orderBy: [desc(deployments.createdAt)]
      });

      if (activeDeployment) {
        return null;
      }

      const [record] = await tx.insert(deployments).values({
        projectId: input.projectId,
        serviceName: input.serviceName,
        status: 'queued',
        commitSha: input.commitSha,
        branch: input.branch,
        metadata: input.metadata ?? {}
      }).returning();

      return record;
    });
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

  async findActiveByService(projectId: string, serviceName: string) {
    return this.db.query.deployments.findMany({
      where: and(
        eq(deployments.projectId, projectId),
        eq(deployments.serviceName, serviceName),
        inArray(deployments.status, ['queued', 'building', 'running'])
      ),
      orderBy: [desc(deployments.createdAt)]
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


  async markFailed(deploymentId: string, message: string) {
    await this.db.transaction(async (tx) => {
      await tx.update(deployments).set({
        status: 'failed',
        finishedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(deployments.id, deploymentId));

      await tx.insert(deploymentLogs).values({
        deploymentId,
        level: 'error',
        message: message.slice(0, 10000)
      });
    });
  }

  async appendLog(input: { deploymentId: string; level: 'info' | 'warn' | 'error'; message: string }) {
    await this.db.insert(deploymentLogs).values({
      deploymentId: input.deploymentId,
      level: input.level,
      message: input.message.slice(0, 10000)
    });
  }
}
