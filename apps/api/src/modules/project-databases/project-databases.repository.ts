import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import {
  projectDatabaseBackupArtifacts,
  projectDatabases,
  projectDatabaseEvents,
  projectDatabaseOperations,
  projectDatabaseRestoreRequests,
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
export type ProjectDatabaseBackupMode = 'none' | 'external';
export type ProjectDatabaseBackupSchedule = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ProjectDatabaseEventKind =
  | 'provisioning'
  | 'runtime_health'
  | 'credentials'
  | 'backup_policy'
  | 'recovery_check'
  | 'backup_operation'
  | 'restore_operation'
  | 'backup_artifact'
  | 'restore_request';
export type ProjectDatabaseOperationKind = 'backup' | 'restore';
export type ProjectDatabaseOperationStatus = 'succeeded' | 'failed';
export type ProjectDatabaseBackupArtifactStorageProvider = 's3' | 'gcs' | 'azure' | 'local' | 'other';
export type ProjectDatabaseBackupArtifactIntegrityStatus = 'unknown' | 'verified' | 'failed';
export type ProjectDatabaseBackupArtifactLifecycleStatus = 'active' | 'archived' | 'purged';
export type ProjectDatabaseRestoreRequestStatus =
  | 'requested'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type ProjectDatabaseRestoreRequestApprovalStatus = 'pending' | 'approved' | 'rejected';

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
  backupMode: ProjectDatabaseBackupMode;
  backupSchedule: ProjectDatabaseBackupSchedule | null;
  backupRunbook: string;
  backupVerifiedAt: Date | null;
  restoreVerifiedAt: Date | null;
  provisionedAt: Date | null;
  lastProvisioningAttemptAt: Date | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  serviceNames: string[];
}

export interface ProjectDatabaseEventRecord {
  id: string;
  projectId: string;
  databaseId: string;
  kind: ProjectDatabaseEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface CreateProjectDatabaseEventInput {
  projectId: string;
  databaseId: string;
  kind: ProjectDatabaseEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface ProjectDatabaseOperationRecord {
  id: string;
  projectId: string;
  databaseId: string;
  kind: ProjectDatabaseOperationKind;
  status: ProjectDatabaseOperationStatus;
  summary: string;
  detail: string;
  recordedAt: Date;
}

export interface CreateProjectDatabaseOperationInput {
  projectId: string;
  databaseId: string;
  kind: ProjectDatabaseOperationKind;
  status: ProjectDatabaseOperationStatus;
  summary: string;
  detail: string;
  recordedAt: Date;
}

export interface ProjectDatabaseBackupArtifactRecord {
  id: string;
  projectId: string;
  databaseId: string;
  label: string;
  storageProvider: ProjectDatabaseBackupArtifactStorageProvider;
  location: string;
  sizeBytes: number | null;
  producedAt: Date;
  retentionExpiresAt: Date | null;
  integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
  lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
  verifiedAt: Date | null;
  lifecycleChangedAt: Date;
  detail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDatabaseBackupArtifactInput {
  projectId: string;
  databaseId: string;
  label: string;
  storageProvider: ProjectDatabaseBackupArtifactStorageProvider;
  location: string;
  sizeBytes: number | null;
  producedAt: Date;
  retentionExpiresAt: Date | null;
  integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
  lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
  verifiedAt: Date | null;
  lifecycleChangedAt: Date;
  detail: string;
}

export interface ProjectDatabaseRestoreRequestRecord {
  id: string;
  projectId: string;
  databaseId: string;
  backupArtifactId: string | null;
  backupArtifactLabel: string | null;
  status: ProjectDatabaseRestoreRequestStatus;
  approvalStatus: ProjectDatabaseRestoreRequestApprovalStatus;
  approvalDetail: string;
  approvalReviewedAt: Date | null;
  target: string;
  summary: string;
  detail: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDatabaseRestoreRequestInput {
  projectId: string;
  databaseId: string;
  backupArtifactId: string | null;
  target: string;
  summary: string;
  detail: string;
  requestedAt: Date;
}

interface ProjectDatabaseRestoreRequestRow extends Omit<
  ProjectDatabaseRestoreRequestRecord,
  'backupArtifactLabel' | 'status' | 'approvalStatus'
> {
  status: string;
  approvalStatus: string;
}

interface ProjectDatabaseRow extends Omit<
  ProjectDatabaseRecord,
  'serviceNames' | 'connectionSslMode' | 'backupMode' | 'backupSchedule'
> {
  connectionSslMode: string | null;
  backupMode: string;
  backupSchedule: string | null;
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

function toProjectDatabaseBackupMode(value: string): ProjectDatabaseBackupMode {
  return value === 'external' ? 'external' : 'none';
}

function toProjectDatabaseBackupSchedule(value: string | null): ProjectDatabaseBackupSchedule | null {
  switch (value) {
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'custom':
      return value;
    default:
      return null;
  }
}

function toProjectDatabaseEventKind(value: string): ProjectDatabaseEventKind {
  switch (value) {
    case 'provisioning':
    case 'runtime_health':
    case 'credentials':
    case 'backup_policy':
    case 'recovery_check':
    case 'backup_operation':
    case 'restore_operation':
    case 'backup_artifact':
    case 'restore_request':
      return value;
    default:
      return 'provisioning';
  }
}

function toProjectDatabaseOperationKind(value: string): ProjectDatabaseOperationKind {
  return value === 'restore' ? 'restore' : 'backup';
}

function toProjectDatabaseOperationStatus(value: string): ProjectDatabaseOperationStatus {
  return value === 'failed' ? 'failed' : 'succeeded';
}

function toProjectDatabaseBackupArtifactStorageProvider(
  value: string
): ProjectDatabaseBackupArtifactStorageProvider {
  switch (value) {
    case 's3':
    case 'gcs':
    case 'azure':
    case 'local':
    case 'other':
      return value;
    default:
      return 'other';
  }
}

function toProjectDatabaseBackupArtifactIntegrityStatus(
  value: string
): ProjectDatabaseBackupArtifactIntegrityStatus {
  switch (value) {
    case 'verified':
    case 'failed':
      return value;
    case 'unknown':
    default:
      return 'unknown';
  }
}

function toProjectDatabaseBackupArtifactLifecycleStatus(
  value: string
): ProjectDatabaseBackupArtifactLifecycleStatus {
  switch (value) {
    case 'archived':
    case 'purged':
      return value;
    case 'active':
    default:
      return 'active';
  }
}

function toProjectDatabaseRestoreRequestStatus(value: string): ProjectDatabaseRestoreRequestStatus {
  switch (value) {
    case 'in_progress':
    case 'succeeded':
    case 'failed':
    case 'cancelled':
      return value;
    case 'requested':
    default:
      return 'requested';
  }
}

function toProjectDatabaseRestoreRequestApprovalStatus(
  value: string
): ProjectDatabaseRestoreRequestApprovalStatus {
  switch (value) {
    case 'approved':
    case 'rejected':
      return value;
    case 'pending':
    default:
      return 'pending';
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
      backupMode: toProjectDatabaseBackupMode(row.backupMode),
      backupSchedule: toProjectDatabaseBackupSchedule(row.backupSchedule),
      serviceNames: serviceNamesByDatabaseId.get(row.id) ?? []
    }));
  }

  private async attachBackupArtifactLabels(
    rows: ProjectDatabaseRestoreRequestRow[]
  ): Promise<ProjectDatabaseRestoreRequestRecord[]> {
    const backupArtifactIds = Array.from(new Set(
      rows
        .flatMap((row) => row.backupArtifactId ? [row.backupArtifactId] : [])
    ));
    const labelsByArtifactId = new Map<string, string>();

    if (backupArtifactIds.length > 0) {
      const artifacts = await this.db
        .select({
          id: projectDatabaseBackupArtifacts.id,
          label: projectDatabaseBackupArtifacts.label
        })
        .from(projectDatabaseBackupArtifacts)
        .where(inArray(projectDatabaseBackupArtifacts.id, backupArtifactIds));

      for (const artifact of artifacts) {
        labelsByArtifactId.set(artifact.id, artifact.label);
      }
    }

    return rows.map((row) => ({
      ...row,
      backupArtifactLabel: row.backupArtifactId
        ? labelsByArtifactId.get(row.backupArtifactId) ?? null
        : null,
      status: toProjectDatabaseRestoreRequestStatus(row.status),
      approvalStatus: toProjectDatabaseRestoreRequestApprovalStatus(row.approvalStatus)
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

  async updateBackupPolicy(input: {
    projectId: string;
    databaseId: string;
    backupMode: ProjectDatabaseBackupMode;
    backupSchedule: ProjectDatabaseBackupSchedule | null;
    backupRunbook: string;
  }): Promise<ProjectDatabaseRecord | null> {
    const rows = await this.db
      .update(projectDatabases)
      .set({
        backupMode: input.backupMode,
        backupSchedule: input.backupSchedule,
        backupRunbook: input.backupRunbook,
        ...(input.backupMode === 'none'
          ? {
              backupVerifiedAt: null,
              restoreVerifiedAt: null
            }
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

  async recordRecoveryCheck(input: {
    projectId: string;
    databaseId: string;
    kind: 'backup' | 'restore';
    verifiedAt: Date;
  }): Promise<ProjectDatabaseRecord | null> {
    const rows = await this.db
      .update(projectDatabases)
      .set({
        ...(input.kind === 'backup'
          ? { backupVerifiedAt: input.verifiedAt }
          : { restoreVerifiedAt: input.verifiedAt }),
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

  async createEvents(input: CreateProjectDatabaseEventInput[]): Promise<ProjectDatabaseEventRecord[]> {
    if (input.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(projectDatabaseEvents)
      .values(input.map((event) => ({
        projectId: event.projectId,
        databaseId: event.databaseId,
        kind: event.kind,
        previousStatus: event.previousStatus,
        nextStatus: event.nextStatus,
        detail: event.detail,
        createdAt: event.createdAt
      })))
      .returning();

    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      databaseId: row.databaseId,
      kind: toProjectDatabaseEventKind(row.kind),
      previousStatus: row.previousStatus,
      nextStatus: row.nextStatus,
      detail: row.detail,
      createdAt: row.createdAt
    }));
  }

  async createOperation(input: CreateProjectDatabaseOperationInput): Promise<ProjectDatabaseOperationRecord> {
    const [row] = await this.db
      .insert(projectDatabaseOperations)
      .values({
        projectId: input.projectId,
        databaseId: input.databaseId,
        kind: input.kind,
        status: input.status,
        summary: input.summary,
        detail: input.detail,
        recordedAt: input.recordedAt
      })
      .returning();

    return {
      id: row.id,
      projectId: row.projectId,
      databaseId: row.databaseId,
      kind: toProjectDatabaseOperationKind(row.kind),
      status: toProjectDatabaseOperationStatus(row.status),
      summary: row.summary,
      detail: row.detail,
      recordedAt: row.recordedAt
    };
  }

  async createBackupArtifact(
    input: CreateProjectDatabaseBackupArtifactInput
  ): Promise<ProjectDatabaseBackupArtifactRecord> {
    const [row] = await this.db
      .insert(projectDatabaseBackupArtifacts)
      .values({
        projectId: input.projectId,
        databaseId: input.databaseId,
        label: input.label,
        storageProvider: input.storageProvider,
        location: input.location,
        sizeBytes: input.sizeBytes,
        producedAt: input.producedAt,
        retentionExpiresAt: input.retentionExpiresAt,
        integrityStatus: input.integrityStatus,
        lifecycleStatus: input.lifecycleStatus,
        verifiedAt: input.verifiedAt,
        lifecycleChangedAt: input.lifecycleChangedAt,
        detail: input.detail
      })
      .returning();

    return {
      id: row.id,
      projectId: row.projectId,
      databaseId: row.databaseId,
      label: row.label,
      storageProvider: toProjectDatabaseBackupArtifactStorageProvider(row.storageProvider),
      location: row.location,
      sizeBytes: row.sizeBytes,
      producedAt: row.producedAt,
      retentionExpiresAt: row.retentionExpiresAt,
      integrityStatus: toProjectDatabaseBackupArtifactIntegrityStatus(row.integrityStatus),
      lifecycleStatus: toProjectDatabaseBackupArtifactLifecycleStatus(row.lifecycleStatus),
      verifiedAt: row.verifiedAt,
      lifecycleChangedAt: row.lifecycleChangedAt,
      detail: row.detail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async findBackupArtifactById(
    projectId: string,
    databaseId: string,
    backupArtifactId: string
  ): Promise<ProjectDatabaseBackupArtifactRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectDatabaseBackupArtifacts)
      .where(and(
        eq(projectDatabaseBackupArtifacts.projectId, projectId),
        eq(projectDatabaseBackupArtifacts.databaseId, databaseId),
        eq(projectDatabaseBackupArtifacts.id, backupArtifactId)
      ))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.projectId,
      databaseId: row.databaseId,
      label: row.label,
      storageProvider: toProjectDatabaseBackupArtifactStorageProvider(row.storageProvider),
      location: row.location,
      sizeBytes: row.sizeBytes,
      producedAt: row.producedAt,
      retentionExpiresAt: row.retentionExpiresAt,
      integrityStatus: toProjectDatabaseBackupArtifactIntegrityStatus(row.integrityStatus),
      lifecycleStatus: toProjectDatabaseBackupArtifactLifecycleStatus(row.lifecycleStatus),
      verifiedAt: row.verifiedAt,
      lifecycleChangedAt: row.lifecycleChangedAt,
      detail: row.detail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async updateBackupArtifact(input: {
    projectId: string;
    databaseId: string;
    backupArtifactId: string;
    integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
    lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
    retentionExpiresAt: Date | null;
    verifiedAt: Date | null;
    lifecycleChangedAt: Date;
    detail: string;
  }): Promise<ProjectDatabaseBackupArtifactRecord | null> {
    const [row] = await this.db
      .update(projectDatabaseBackupArtifacts)
      .set({
        integrityStatus: input.integrityStatus,
        lifecycleStatus: input.lifecycleStatus,
        retentionExpiresAt: input.retentionExpiresAt,
        verifiedAt: input.verifiedAt,
        lifecycleChangedAt: input.lifecycleChangedAt,
        detail: input.detail,
        updatedAt: new Date()
      })
      .where(and(
        eq(projectDatabaseBackupArtifacts.projectId, input.projectId),
        eq(projectDatabaseBackupArtifacts.databaseId, input.databaseId),
        eq(projectDatabaseBackupArtifacts.id, input.backupArtifactId)
      ))
      .returning();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.projectId,
      databaseId: row.databaseId,
      label: row.label,
      storageProvider: toProjectDatabaseBackupArtifactStorageProvider(row.storageProvider),
      location: row.location,
      sizeBytes: row.sizeBytes,
      producedAt: row.producedAt,
      retentionExpiresAt: row.retentionExpiresAt,
      integrityStatus: toProjectDatabaseBackupArtifactIntegrityStatus(row.integrityStatus),
      lifecycleStatus: toProjectDatabaseBackupArtifactLifecycleStatus(row.lifecycleStatus),
      verifiedAt: row.verifiedAt,
      lifecycleChangedAt: row.lifecycleChangedAt,
      detail: row.detail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async createRestoreRequest(
    input: CreateProjectDatabaseRestoreRequestInput
  ): Promise<ProjectDatabaseRestoreRequestRecord> {
    const [row] = await this.db
      .insert(projectDatabaseRestoreRequests)
      .values({
        projectId: input.projectId,
        databaseId: input.databaseId,
        backupArtifactId: input.backupArtifactId,
        status: 'requested',
        approvalStatus: 'pending',
        target: input.target,
        summary: input.summary,
        detail: input.detail,
        requestedAt: input.requestedAt
      })
      .returning();

    const [hydrated] = await this.attachBackupArtifactLabels([row]);
    return hydrated!;
  }

  async findRestoreRequestById(
    projectId: string,
    databaseId: string,
    restoreRequestId: string
  ): Promise<ProjectDatabaseRestoreRequestRecord | null> {
    const rows = await this.db
      .select()
      .from(projectDatabaseRestoreRequests)
      .where(and(
        eq(projectDatabaseRestoreRequests.projectId, projectId),
        eq(projectDatabaseRestoreRequests.databaseId, databaseId),
        eq(projectDatabaseRestoreRequests.id, restoreRequestId)
      ))
      .limit(1);

    const [hydrated] = await this.attachBackupArtifactLabels(rows);
    return hydrated ?? null;
  }

  async updateRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    status: ProjectDatabaseRestoreRequestStatus;
    detail: string;
    startedAt: Date | null;
    completedAt: Date | null;
  }): Promise<ProjectDatabaseRestoreRequestRecord | null> {
    const rows = await this.db
      .update(projectDatabaseRestoreRequests)
      .set({
        status: input.status,
        detail: input.detail,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        updatedAt: new Date()
      })
      .where(and(
        eq(projectDatabaseRestoreRequests.projectId, input.projectId),
        eq(projectDatabaseRestoreRequests.databaseId, input.databaseId),
        eq(projectDatabaseRestoreRequests.id, input.restoreRequestId)
      ))
      .returning();

    const [hydrated] = await this.attachBackupArtifactLabels(rows);
    return hydrated ?? null;
  }

  async reviewRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    approvalStatus: ProjectDatabaseRestoreRequestApprovalStatus;
    approvalDetail: string;
    approvalReviewedAt: Date;
  }): Promise<ProjectDatabaseRestoreRequestRecord | null> {
    const rows = await this.db
      .update(projectDatabaseRestoreRequests)
      .set({
        approvalStatus: input.approvalStatus,
        approvalDetail: input.approvalDetail,
        approvalReviewedAt: input.approvalReviewedAt,
        updatedAt: new Date()
      })
      .where(and(
        eq(projectDatabaseRestoreRequests.projectId, input.projectId),
        eq(projectDatabaseRestoreRequests.databaseId, input.databaseId),
        eq(projectDatabaseRestoreRequests.id, input.restoreRequestId)
      ))
      .returning();

    const [hydrated] = await this.attachBackupArtifactLabels(rows);
    return hydrated ?? null;
  }

  async listRecentEventsByDatabaseIds(databaseIds: string[], limitPerDatabase = 6): Promise<ProjectDatabaseEventRecord[]> {
    if (databaseIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(projectDatabaseEvents)
      .where(inArray(projectDatabaseEvents.databaseId, databaseIds))
      .orderBy(desc(projectDatabaseEvents.createdAt));

    const countsByDatabaseId = new Map<string, number>();
    const trimmed: ProjectDatabaseEventRecord[] = [];

    for (const row of rows) {
      const count = countsByDatabaseId.get(row.databaseId) ?? 0;
      if (count >= limitPerDatabase) {
        continue;
      }

      countsByDatabaseId.set(row.databaseId, count + 1);
      trimmed.push({
        id: row.id,
        projectId: row.projectId,
        databaseId: row.databaseId,
        kind: toProjectDatabaseEventKind(row.kind),
        previousStatus: row.previousStatus,
        nextStatus: row.nextStatus,
        detail: row.detail,
        createdAt: row.createdAt
      });
    }

    return trimmed;
  }

  async listRecentOperationsByDatabaseIds(databaseIds: string[], limitPerDatabase = 8): Promise<ProjectDatabaseOperationRecord[]> {
    if (databaseIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(projectDatabaseOperations)
      .where(inArray(projectDatabaseOperations.databaseId, databaseIds))
      .orderBy(desc(projectDatabaseOperations.recordedAt));

    const countsByDatabaseId = new Map<string, number>();
    const trimmed: ProjectDatabaseOperationRecord[] = [];

    for (const row of rows) {
      const count = countsByDatabaseId.get(row.databaseId) ?? 0;
      if (count >= limitPerDatabase) {
        continue;
      }

      countsByDatabaseId.set(row.databaseId, count + 1);
      trimmed.push({
        id: row.id,
        projectId: row.projectId,
        databaseId: row.databaseId,
        kind: toProjectDatabaseOperationKind(row.kind),
        status: toProjectDatabaseOperationStatus(row.status),
        summary: row.summary,
        detail: row.detail,
        recordedAt: row.recordedAt
      });
    }

    return trimmed;
  }

  async listRecentBackupArtifactsByDatabaseIds(
    databaseIds: string[],
    limitPerDatabase = 8
  ): Promise<ProjectDatabaseBackupArtifactRecord[]> {
    if (databaseIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(projectDatabaseBackupArtifacts)
      .where(inArray(projectDatabaseBackupArtifacts.databaseId, databaseIds))
      .orderBy(desc(projectDatabaseBackupArtifacts.producedAt), desc(projectDatabaseBackupArtifacts.createdAt));

    const countsByDatabaseId = new Map<string, number>();
    const trimmed: ProjectDatabaseBackupArtifactRecord[] = [];

    for (const row of rows) {
      const count = countsByDatabaseId.get(row.databaseId) ?? 0;
      if (count >= limitPerDatabase) {
        continue;
      }

      countsByDatabaseId.set(row.databaseId, count + 1);
      trimmed.push({
        id: row.id,
        projectId: row.projectId,
        databaseId: row.databaseId,
        label: row.label,
        storageProvider: toProjectDatabaseBackupArtifactStorageProvider(row.storageProvider),
        location: row.location,
        sizeBytes: row.sizeBytes,
        producedAt: row.producedAt,
        retentionExpiresAt: row.retentionExpiresAt,
        integrityStatus: toProjectDatabaseBackupArtifactIntegrityStatus(row.integrityStatus),
        lifecycleStatus: toProjectDatabaseBackupArtifactLifecycleStatus(row.lifecycleStatus),
        verifiedAt: row.verifiedAt,
        lifecycleChangedAt: row.lifecycleChangedAt,
        detail: row.detail,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
    }

    return trimmed;
  }

  async listRecentRestoreRequestsByDatabaseIds(
    databaseIds: string[],
    limitPerDatabase = 8
  ): Promise<ProjectDatabaseRestoreRequestRecord[]> {
    if (databaseIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(projectDatabaseRestoreRequests)
      .where(inArray(projectDatabaseRestoreRequests.databaseId, databaseIds))
      .orderBy(desc(projectDatabaseRestoreRequests.requestedAt), desc(projectDatabaseRestoreRequests.createdAt));

    const countsByDatabaseId = new Map<string, number>();
    const trimmed: ProjectDatabaseRestoreRequestRow[] = [];

    for (const row of rows) {
      const count = countsByDatabaseId.get(row.databaseId) ?? 0;
      if (count >= limitPerDatabase) {
        continue;
      }

      countsByDatabaseId.set(row.databaseId, count + 1);
      trimmed.push(row);
    }

    return this.attachBackupArtifactLabels(trimmed);
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
        backupMode: projectDatabases.backupMode,
        backupSchedule: projectDatabases.backupSchedule,
        backupRunbook: projectDatabases.backupRunbook,
        backupVerifiedAt: projectDatabases.backupVerifiedAt,
        restoreVerifiedAt: projectDatabases.restoreVerifiedAt,
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
