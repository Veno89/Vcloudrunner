import { and, asc, eq, inArray } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import {
  projectDatabases,
  projectDatabaseServiceLinks
} from '../../db/schema.js';

export type ProjectDatabaseEngine = 'postgres';
export type ProjectDatabaseStatus = 'pending_config' | 'provisioning' | 'ready' | 'failed';
export type ProjectDatabaseHealthStatus =
  | 'unknown'
  | 'healthy'
  | 'unreachable'
  | 'credentials_invalid'
  | 'failing';

export interface ProjectDatabaseRecord {
  id: string;
  projectId: string;
  engine: ProjectDatabaseEngine;
  name: string;
  status: ProjectDatabaseStatus;
  statusDetail: string;
  databaseName: string;
  username: string;
  encryptedPassword: string;
  connectionHost: string | null;
  connectionPort: number | null;
  connectionSslMode: 'disable' | 'prefer' | 'require' | null;
  healthStatus: ProjectDatabaseHealthStatus;
  healthStatusDetail: string;
  healthStatusChangedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthyAt: Date | null;
  lastHealthErrorAt: Date | null;
  consecutiveHealthCheckFailures: number;
  credentialsRotatedAt: Date | null;
  provisionedAt: Date | null;
  lastProvisioningAttemptAt: Date | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  serviceNames: string[];
}

interface ProjectDatabaseRow extends Omit<ProjectDatabaseRecord, 'serviceNames' | 'connectionSslMode'> {
  connectionSslMode: string | null;
}

function toConnectionSslMode(value: string | null): 'disable' | 'prefer' | 'require' | null {
  return value === 'disable' || value === 'prefer' || value === 'require'
    ? value
    : null;
}

function toProjectDatabaseHealthStatus(value: string): ProjectDatabaseHealthStatus {
  switch (value) {
    case 'healthy':
    case 'unreachable':
    case 'credentials_invalid':
    case 'failing':
      return value;
    case 'unknown':
    default:
      return 'unknown';
  }
}

export class ProjectDatabasesRepository {
  constructor(private readonly db: DbClient) {}

  private async listServiceNamesByDatabaseIds(databaseIds: string[]) {
    if (databaseIds.length === 0) {
      return new Map<string, string[]>();
    }

    const rows = await this.db
      .select({
        projectDatabaseId: projectDatabaseServiceLinks.projectDatabaseId,
        serviceName: projectDatabaseServiceLinks.serviceName
      })
      .from(projectDatabaseServiceLinks)
      .where(inArray(projectDatabaseServiceLinks.projectDatabaseId, databaseIds))
      .orderBy(asc(projectDatabaseServiceLinks.serviceName));

    const serviceNamesByDatabaseId = new Map<string, string[]>();

    for (const row of rows) {
      const items = serviceNamesByDatabaseId.get(row.projectDatabaseId) ?? [];
      items.push(row.serviceName);
      serviceNamesByDatabaseId.set(row.projectDatabaseId, items);
    }

    return serviceNamesByDatabaseId;
  }

  private async hydrateRecords(rows: ProjectDatabaseRow[]): Promise<ProjectDatabaseRecord[]> {
    const serviceNamesByDatabaseId = await this.listServiceNamesByDatabaseIds(rows.map((row) => row.id));

    return rows.map((row) => ({
      ...row,
      connectionSslMode: toConnectionSslMode(row.connectionSslMode),
      healthStatus: toProjectDatabaseHealthStatus(row.healthStatus),
      serviceNames: serviceNamesByDatabaseId.get(row.id) ?? []
    }));
  }

  async listByProject(projectId: string): Promise<ProjectDatabaseRecord[]> {
    const rows = await this.db
      .select()
      .from(projectDatabases)
      .where(eq(projectDatabases.projectId, projectId))
      .orderBy(asc(projectDatabases.name));

    return this.hydrateRecords(rows);
  }

  async findById(projectId: string, databaseId: string): Promise<ProjectDatabaseRecord | null> {
    const rows = await this.db
      .select()
      .from(projectDatabases)
      .where(and(
        eq(projectDatabases.projectId, projectId),
        eq(projectDatabases.id, databaseId)
      ))
      .limit(1);

    const hydrated = await this.hydrateRecords(rows);
    return hydrated[0] ?? null;
  }

  async create(input: {
    projectId: string;
    engine: ProjectDatabaseEngine;
    name: string;
    status: ProjectDatabaseStatus;
    statusDetail: string;
    databaseName: string;
    username: string;
    encryptedPassword: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseRecord> {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .insert(projectDatabases)
        .values({
          projectId: input.projectId,
          engine: input.engine,
          name: input.name,
          status: input.status,
          statusDetail: input.statusDetail,
          databaseName: input.databaseName,
          username: input.username,
          encryptedPassword: input.encryptedPassword,
          lastProvisioningAttemptAt: new Date()
        })
        .returning();

      if (input.serviceNames.length > 0) {
        await tx.insert(projectDatabaseServiceLinks).values(
          input.serviceNames.map((serviceName) => ({
            projectDatabaseId: record.id,
            serviceName
          }))
        );
      }

      const hydrated = await this.hydrateRecords([record]);
      return hydrated[0]!;
    });
  }

  async updateOperationalState(input: {
    projectId: string;
    databaseId: string;
    status: ProjectDatabaseStatus;
    statusDetail: string;
    connectionHost: string | null;
    connectionPort: number | null;
    connectionSslMode: 'disable' | 'prefer' | 'require' | null;
    healthStatus: ProjectDatabaseHealthStatus;
    healthStatusDetail: string;
    healthStatusChangedAt: Date | null;
    lastHealthCheckAt: Date | null;
    lastHealthyAt: Date | null;
    lastHealthErrorAt: Date | null;
    consecutiveHealthCheckFailures: number;
    provisionedAt: Date | null;
    lastProvisioningAttemptAt: Date;
    lastErrorAt: Date | null;
    encryptedPassword?: string;
    credentialsRotatedAt?: Date | null;
  }): Promise<ProjectDatabaseRecord | null> {
    const rows = await this.db
      .update(projectDatabases)
      .set({
        status: input.status,
        statusDetail: input.statusDetail,
        connectionHost: input.connectionHost,
        connectionPort: input.connectionPort,
        connectionSslMode: input.connectionSslMode,
        healthStatus: input.healthStatus,
        healthStatusDetail: input.healthStatusDetail,
        healthStatusChangedAt: input.healthStatusChangedAt,
        lastHealthCheckAt: input.lastHealthCheckAt,
        lastHealthyAt: input.lastHealthyAt,
        lastHealthErrorAt: input.lastHealthErrorAt,
        consecutiveHealthCheckFailures: input.consecutiveHealthCheckFailures,
        provisionedAt: input.provisionedAt,
        lastProvisioningAttemptAt: input.lastProvisioningAttemptAt,
        lastErrorAt: input.lastErrorAt,
        ...(input.encryptedPassword ? { encryptedPassword: input.encryptedPassword } : {}),
        ...(input.credentialsRotatedAt !== undefined
          ? { credentialsRotatedAt: input.credentialsRotatedAt }
          : {}),
        updatedAt: new Date()
      })
      .where(and(
        eq(projectDatabases.projectId, input.projectId),
        eq(projectDatabases.id, input.databaseId)
      ))
      .returning();

    const hydrated = await this.hydrateRecords(rows);
    return hydrated[0] ?? null;
  }

  async replaceServiceLinks(input: {
    projectId: string;
    databaseId: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseRecord | null> {
    return this.db.transaction(async (tx) => {
      const [databaseRecord] = await tx
        .select()
        .from(projectDatabases)
        .where(and(
          eq(projectDatabases.projectId, input.projectId),
          eq(projectDatabases.id, input.databaseId)
        ))
        .limit(1);

      if (!databaseRecord) {
        return null;
      }

      await tx
        .delete(projectDatabaseServiceLinks)
        .where(eq(projectDatabaseServiceLinks.projectDatabaseId, input.databaseId));

      if (input.serviceNames.length > 0) {
        await tx.insert(projectDatabaseServiceLinks).values(
          input.serviceNames.map((serviceName) => ({
            projectDatabaseId: input.databaseId,
            serviceName
          }))
        );
      }

      const hydrated = await this.hydrateRecords([databaseRecord]);
      return hydrated[0] ?? null;
    });
  }

  async delete(projectId: string, databaseId: string): Promise<boolean> {
    const rows = await this.db
      .delete(projectDatabases)
      .where(and(
        eq(projectDatabases.projectId, projectId),
        eq(projectDatabases.id, databaseId)
      ))
      .returning({ id: projectDatabases.id });

    return rows.length > 0;
  }

  async listLinkedReadyByProjectService(projectId: string, serviceName: string): Promise<ProjectDatabaseRecord[]> {
    const rows = await this.db
      .select({
        id: projectDatabases.id,
        projectId: projectDatabases.projectId,
        engine: projectDatabases.engine,
        name: projectDatabases.name,
        status: projectDatabases.status,
        statusDetail: projectDatabases.statusDetail,
        databaseName: projectDatabases.databaseName,
        username: projectDatabases.username,
        encryptedPassword: projectDatabases.encryptedPassword,
        connectionHost: projectDatabases.connectionHost,
        connectionPort: projectDatabases.connectionPort,
        connectionSslMode: projectDatabases.connectionSslMode,
        healthStatus: projectDatabases.healthStatus,
        healthStatusDetail: projectDatabases.healthStatusDetail,
        healthStatusChangedAt: projectDatabases.healthStatusChangedAt,
        lastHealthCheckAt: projectDatabases.lastHealthCheckAt,
        lastHealthyAt: projectDatabases.lastHealthyAt,
        lastHealthErrorAt: projectDatabases.lastHealthErrorAt,
        consecutiveHealthCheckFailures: projectDatabases.consecutiveHealthCheckFailures,
        credentialsRotatedAt: projectDatabases.credentialsRotatedAt,
        provisionedAt: projectDatabases.provisionedAt,
        lastProvisioningAttemptAt: projectDatabases.lastProvisioningAttemptAt,
        lastErrorAt: projectDatabases.lastErrorAt,
        createdAt: projectDatabases.createdAt,
        updatedAt: projectDatabases.updatedAt
      })
      .from(projectDatabases)
      .innerJoin(
        projectDatabaseServiceLinks,
        eq(projectDatabaseServiceLinks.projectDatabaseId, projectDatabases.id)
      )
      .where(and(
        eq(projectDatabases.projectId, projectId),
        eq(projectDatabases.status, 'ready'),
        eq(projectDatabaseServiceLinks.serviceName, serviceName)
      ))
      .orderBy(asc(projectDatabases.name));

    return this.hydrateRecords(rows);
  }
}
