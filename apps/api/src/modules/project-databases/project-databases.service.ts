import { randomBytes } from 'node:crypto';
import {
  createManagedPostgresEnvKeys,
  getProjectServiceByName,
  normalizeProjectServices
} from '@vcloudrunner/shared-types';

import type { DbClient } from '../../db/client.js';
import {
  ProjectDatabaseBackupArtifactNotAllowedError,
  ProjectDatabaseBackupArtifactUnavailableError,
  ProjectDatabaseBackupArtifactNotFoundError,
  InvalidProjectServiceError,
  ProjectDatabaseAlreadyExistsError,
  ProjectDatabaseCredentialRotationFailedError,
  ProjectDatabaseCredentialRotationNotAllowedError,
  ProjectDatabaseDeprovisioningFailedError,
  ProjectDatabaseNotFoundError,
  ProjectDatabaseRecoveryCheckNotAllowedError,
  ProjectDatabaseRestoreRequestApprovalNotAllowedError,
  ProjectDatabaseRestoreRequestNotAllowedError,
  ProjectDatabaseRestoreRequestNotFoundError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';
import { CryptoService } from '../../services/crypto.service.js';
import {
  buildManagedPostgresConnectionString,
  createConfiguredManagedPostgresProvisioner,
  type ManagedPostgresProvisioner
} from '../../services/managed-postgres-provisioner.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import {
  ProjectDatabasesRepository,
  type ProjectDatabaseBackupArtifactIntegrityStatus,
  type ProjectDatabaseBackupArtifactLifecycleStatus,
  type ProjectDatabaseBackupArtifactRecord,
  type ProjectDatabaseBackupArtifactStorageProvider,
  type ProjectDatabaseBackupMode,
  type ProjectDatabaseBackupSchedule,
  type ProjectDatabaseEventRecord,
  type ProjectDatabaseOperationRecord,
  type ProjectDatabaseOperationStatus,
  type ProjectDatabaseRecord,
  type ProjectDatabaseRestoreRequestApprovalStatus,
  type ProjectDatabaseRestoreRequestRecord,
  type ProjectDatabaseRestoreRequestStatus
} from './project-databases.repository.js';
import {
  buildBackupCoverage,
  buildOperationalEvents,
  createManagedIdentifier,
  createUnknownHealthSnapshot,
  isBackupArtifactRestorable,
  isProjectDatabaseNameUniqueViolation,
  normalizeManagedDatabaseName,
  toViewRecord
} from './project-databases-helpers.js';
import type {
  ProjectDatabaseAuditExport,
  ProjectDatabaseHealthSnapshot,
  ProjectDatabaseViewRecord
} from './project-databases.service.types.js';

export type {
  ProjectDatabaseAuditExport,
  ProjectDatabaseBackupCoverage,
  ProjectDatabaseBackupExecution,
  ProjectDatabaseBackupInventory,
  ProjectDatabaseHealthSnapshot,
  ProjectDatabaseOperationView,
  ProjectDatabaseRecentEvent,
  ProjectDatabaseRestoreExercise,
  ProjectDatabaseRestoreRequestView,
  ProjectDatabaseRestoreWorkflow,
  ProjectDatabaseViewRecord
} from './project-databases.service.types.js';

interface ProjectDatabasesServiceDependencies {
  projectsRepository?: ProjectsRepository;
  projectDatabasesRepository?: ProjectDatabasesRepository;
  cryptoService?: CryptoService;
  managedPostgresProvisioner?: ManagedPostgresProvisioner;
}

export class ProjectDatabasesService {
  private readonly projectsRepository: ProjectsRepository;
  private readonly projectDatabasesRepository: ProjectDatabasesRepository;
  private readonly cryptoService: CryptoService;
  private readonly managedPostgresProvisioner: ManagedPostgresProvisioner;

  constructor(
    db: DbClient,
    dependencies: ProjectDatabasesServiceDependencies = {}
  ) {
    this.projectsRepository = dependencies.projectsRepository ?? new ProjectsRepository(db);
    this.projectDatabasesRepository = dependencies.projectDatabasesRepository ?? new ProjectDatabasesRepository(db);
    this.cryptoService = dependencies.cryptoService ?? new CryptoService();
    this.managedPostgresProvisioner = dependencies.managedPostgresProvisioner ?? createConfiguredManagedPostgresProvisioner();
  }

  private buildViewRecord(
    ...args: [
      record: ProjectDatabaseRecord,
      recentEvents?: ProjectDatabaseEventRecord[],
      recentOperations?: ProjectDatabaseOperationRecord[],
      recentBackupArtifacts?: ProjectDatabaseBackupArtifactRecord[],
      recentRestoreRequests?: ProjectDatabaseRestoreRequestRecord[]
    ]
  ): ProjectDatabaseViewRecord {
    const [record, ...rest] = args;
    return toViewRecord(record, (e) => this.cryptoService.decrypt(e), ...rest);
  }

  private async requireProject(projectId: string) {
    const project = await this.projectsRepository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    return project;
  }

  private validateServiceNames(project: Awaited<ReturnType<ProjectsRepository['findById']>>, serviceNames: string[]) {
    const normalizedServices = normalizeProjectServices(project?.services);
    const deduplicated = Array.from(new Set(
      serviceNames
        .map((serviceName) => serviceName.trim())
        .filter((serviceName) => serviceName.length > 0)
    ));

    for (const serviceName of deduplicated) {
      if (!getProjectServiceByName(normalizedServices, serviceName)) {
        throw new InvalidProjectServiceError(serviceName);
      }
    }

    return deduplicated;
  }

  private async inspectRuntimeHealth(input: {
    record: ProjectDatabaseRecord;
    password: string;
    status: ProjectDatabaseViewRecord['status'];
    connectionHost: string | null;
    connectionPort: number | null;
    connectionSslMode: 'disable' | 'prefer' | 'require' | null;
  }): Promise<ProjectDatabaseHealthSnapshot> {
    if (input.status !== 'ready') {
      return createUnknownHealthSnapshot(
        input.record,
        'Runtime health checks are waiting for managed Postgres provisioning to reach a ready state.'
      );
    }

    const healthResult = await this.managedPostgresProvisioner.checkHealth({
      databaseName: input.record.databaseName,
      username: input.record.username,
      password: input.password,
      connectionHost: input.connectionHost,
      connectionPort: input.connectionPort,
      connectionSslMode: input.connectionSslMode
    });

    if (healthResult.status === 'unknown' || !healthResult.checkedAt) {
      return createUnknownHealthSnapshot(input.record, healthResult.statusDetail);
    }

    return {
      healthStatus: healthResult.status,
      healthStatusDetail: healthResult.statusDetail,
      healthStatusChangedAt:
        input.record.healthStatus === healthResult.status
          ? input.record.healthStatusChangedAt
          : healthResult.checkedAt,
      lastHealthCheckAt: healthResult.checkedAt,
      lastHealthyAt:
        healthResult.status === 'healthy'
          ? healthResult.checkedAt
          : input.record.lastHealthyAt,
      lastHealthErrorAt:
        healthResult.status === 'healthy'
          ? input.record.lastHealthErrorAt
          : healthResult.checkedAt,
      consecutiveHealthCheckFailures:
        healthResult.status === 'healthy'
          ? 0
          : input.record.healthStatus === healthResult.status
            ? input.record.consecutiveHealthCheckFailures + 1
            : 1
    };
  }

  private async persistProvisioningState(input: {
    record: ProjectDatabaseRecord;
    password: string;
    encryptedPassword?: string;
    credentialsRotatedAt?: Date | null;
    statusDetailOverride?: string;
  }) {
    const attemptedAt = new Date();
    const result = await this.managedPostgresProvisioner.provision({
      databaseName: input.record.databaseName,
      username: input.record.username,
      password: input.password
    });

    const healthSnapshot = await this.inspectRuntimeHealth({
      record: input.record,
      password: input.password,
      status: result.status,
      connectionHost: result.connectionHost,
      connectionPort: result.connectionPort,
      connectionSslMode: result.connectionSslMode
    });

    const updated = await this.projectDatabasesRepository.updateOperationalState({
      projectId: input.record.projectId,
      databaseId: input.record.id,
      status: result.status,
      statusDetail:
        result.status === 'ready' && input.statusDetailOverride
          ? input.statusDetailOverride
          : result.statusDetail,
      connectionHost: result.connectionHost,
      connectionPort: result.connectionPort,
      connectionSslMode: result.connectionSslMode,
      healthStatus: healthSnapshot.healthStatus,
      healthStatusDetail: healthSnapshot.healthStatusDetail,
      healthStatusChangedAt: healthSnapshot.healthStatusChangedAt,
      lastHealthCheckAt: healthSnapshot.lastHealthCheckAt,
      lastHealthyAt: healthSnapshot.lastHealthyAt,
      lastHealthErrorAt: healthSnapshot.lastHealthErrorAt,
      consecutiveHealthCheckFailures: healthSnapshot.consecutiveHealthCheckFailures,
      provisionedAt: result.provisionedAt ?? input.record.provisionedAt,
      lastProvisioningAttemptAt: attemptedAt,
      lastErrorAt: result.lastErrorAt,
      ...(input.encryptedPassword ? { encryptedPassword: input.encryptedPassword } : {}),
      ...(input.credentialsRotatedAt !== undefined
        ? { credentialsRotatedAt: input.credentialsRotatedAt }
        : {})
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const events = buildOperationalEvents({
      previous: input.record,
      next: updated
    });

    if (events.length > 0) {
      await this.projectDatabasesRepository.createEvents(events);
    }

    return updated;
  }

  private async loadRecentDatabaseCollections(databaseId: string) {
    const [
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    ] = await Promise.all([
      this.projectDatabasesRepository.listRecentEventsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentOperationsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds([databaseId]),
      this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds([databaseId])
    ]);

    return {
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    };
  }

  async listProjectDatabases(projectId: string): Promise<ProjectDatabaseViewRecord[]> {
    await this.requireProject(projectId);
    const records = await this.projectDatabasesRepository.listByProject(projectId);
    const recentEvents = await this.projectDatabasesRepository.listRecentEventsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentOperations = await this.projectDatabasesRepository.listRecentOperationsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentBackupArtifacts = await this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentRestoreRequests = await this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds(
      records.map((record) => record.id)
    );
    const recentEventsByDatabaseId = new Map<string, ProjectDatabaseEventRecord[]>();
    const recentOperationsByDatabaseId = new Map<string, ProjectDatabaseOperationRecord[]>();
    const recentBackupArtifactsByDatabaseId = new Map<string, ProjectDatabaseBackupArtifactRecord[]>();
    const recentRestoreRequestsByDatabaseId = new Map<string, ProjectDatabaseRestoreRequestRecord[]>();

    for (const event of recentEvents) {
      const items = recentEventsByDatabaseId.get(event.databaseId) ?? [];
      items.push(event);
      recentEventsByDatabaseId.set(event.databaseId, items);
    }

    for (const operation of recentOperations) {
      const items = recentOperationsByDatabaseId.get(operation.databaseId) ?? [];
      items.push(operation);
      recentOperationsByDatabaseId.set(operation.databaseId, items);
    }

    for (const artifact of recentBackupArtifacts) {
      const items = recentBackupArtifactsByDatabaseId.get(artifact.databaseId) ?? [];
      items.push(artifact);
      recentBackupArtifactsByDatabaseId.set(artifact.databaseId, items);
    }

    for (const request of recentRestoreRequests) {
      const items = recentRestoreRequestsByDatabaseId.get(request.databaseId) ?? [];
      items.push(request);
      recentRestoreRequestsByDatabaseId.set(request.databaseId, items);
    }

    return records.map((record) =>
      this.buildViewRecord(
        record,
        recentEventsByDatabaseId.get(record.id) ?? [],
        recentOperationsByDatabaseId.get(record.id) ?? [],
        recentBackupArtifactsByDatabaseId.get(record.id) ?? [],
        recentRestoreRequestsByDatabaseId.get(record.id) ?? []
      )
    );
  }

  async createProjectDatabase(input: {
    projectId: string;
    name: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseViewRecord> {
    const project = await this.requireProject(input.projectId);
    const normalizedName = normalizeManagedDatabaseName(input.name);
    const validatedServiceNames = this.validateServiceNames(project, input.serviceNames);
    const suffix = randomBytes(3).toString('hex');
    const databaseName = createManagedIdentifier({
      prefix: 'db',
      projectSlug: project.slug,
      databaseName: normalizedName,
      suffix
    });
    const username = createManagedIdentifier({
      prefix: 'user',
      projectSlug: project.slug,
      databaseName: normalizedName,
      suffix
    });
    const password = randomBytes(18).toString('hex');
    const encryptedPassword = this.cryptoService.encrypt(password);

    let created: ProjectDatabaseRecord;
    try {
      created = await this.projectDatabasesRepository.create({
        projectId: input.projectId,
        engine: 'postgres',
        name: normalizedName,
        status: 'provisioning',
        statusDetail: 'Provisioning managed Postgres credentials and database resources.',
        databaseName,
        username,
        encryptedPassword,
        serviceNames: validatedServiceNames
      });
    } catch (error) {
      if (isProjectDatabaseNameUniqueViolation(error)) {
        throw new ProjectDatabaseAlreadyExistsError();
      }

      throw error;
    }

    const provisioned = await this.persistProvisioningState({
      record: created,
      password
    });
    return this.buildViewRecord(provisioned);
  }

  async reconcileProjectDatabase(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const password = this.cryptoService.decrypt(record.encryptedPassword);
    const provisioned = await this.persistProvisioningState({
      record,
      password
    });
    return this.buildViewRecord(provisioned);
  }

  async rotateProjectDatabaseCredentials(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (
      record.status !== 'ready'
      || !record.connectionHost
      || !record.connectionPort
      || !record.connectionSslMode
    ) {
      throw new ProjectDatabaseCredentialRotationNotAllowedError();
    }

    const previousPassword = this.cryptoService.decrypt(record.encryptedPassword);
    const nextPassword = randomBytes(18).toString('hex');
    const encryptedPassword = this.cryptoService.encrypt(nextPassword);
    const rotationResult = await this.managedPostgresProvisioner.rotateCredentials({
      databaseName: record.databaseName,
      username: record.username,
      previousPassword,
      nextPassword,
      connectionHost: record.connectionHost,
      connectionPort: record.connectionPort,
      connectionSslMode: record.connectionSslMode
    });

    if (rotationResult.status !== 'rotated' || !rotationResult.rotatedAt) {
      throw new ProjectDatabaseCredentialRotationFailedError(rotationResult.statusDetail);
    }

    const rotated = await this.persistProvisioningState({
      record,
      password: nextPassword,
      encryptedPassword,
      credentialsRotatedAt: rotationResult.rotatedAt,
      statusDetailOverride: rotationResult.statusDetail
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: rotated.projectId,
      databaseId: rotated.id,
      kind: 'credentials',
      previousStatus: record.credentialsRotatedAt ? 'rotated' : 'active',
      nextStatus: 'rotated',
      detail: rotationResult.statusDetail,
      createdAt: rotationResult.rotatedAt
    }]);

    return this.buildViewRecord(rotated);
  }

  async updateProjectDatabaseBackupPolicy(input: {
    projectId: string;
    databaseId: string;
    backupMode: ProjectDatabaseBackupMode;
    backupSchedule: ProjectDatabaseBackupSchedule | null;
    backupRunbook: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const normalizedRunbook = input.backupRunbook.trim();
    const normalizedSchedule = input.backupMode === 'external' ? input.backupSchedule : null;
    const normalizedMode = input.backupMode;
    const updated = await this.projectDatabasesRepository.updateBackupPolicy({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupMode: normalizedMode,
      backupSchedule: normalizedSchedule,
      backupRunbook: normalizedMode === 'external' ? normalizedRunbook : ''
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const previousCoverage = buildBackupCoverage(record);
    const nextCoverage = buildBackupCoverage(updated);

    if (
      previousCoverage.status !== nextCoverage.status
      || record.backupMode !== updated.backupMode
      || record.backupSchedule !== updated.backupSchedule
      || record.backupRunbook !== updated.backupRunbook
    ) {
      await this.projectDatabasesRepository.createEvents([{
        projectId: updated.projectId,
        databaseId: updated.id,
        kind: 'backup_policy',
        previousStatus: previousCoverage.status,
        nextStatus: nextCoverage.status,
        detail: nextCoverage.detail,
        createdAt: new Date()
      }]);
    }

    return this.buildViewRecord(updated);
  }

  async recordProjectDatabaseRecoveryCheck(input: {
    projectId: string;
    databaseId: string;
    kind: 'backup' | 'restore';
    status?: ProjectDatabaseOperationStatus;
    summary?: string;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseRecoveryCheckNotAllowedError();
    }

    const status = input.status ?? 'succeeded';
    const summary = input.summary?.trim().length
      ? input.summary.trim()
      : status === 'failed'
        ? input.kind === 'backup'
          ? 'External backup run failed'
          : 'External restore drill failed'
        : input.kind === 'backup'
          ? 'External backup run recorded'
          : 'External restore drill recorded';
    const detail = input.detail?.trim() ?? '';
    const recordedAt = new Date();
    const operation = await this.projectDatabasesRepository.createOperation({
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: input.kind,
      status,
      summary,
      detail,
      recordedAt
    });

    const updated = status === 'succeeded'
      ? await this.projectDatabasesRepository.recordRecoveryCheck({
          projectId: input.projectId,
          databaseId: input.databaseId,
          kind: input.kind,
          verifiedAt: recordedAt
        })
      : record;

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    const [event] = await this.projectDatabasesRepository.createEvents([{
      projectId: updated.projectId,
      databaseId: updated.id,
      kind: input.kind === 'backup' ? 'backup_operation' : 'restore_operation',
      previousStatus: null,
      nextStatus: status,
      detail: detail.length > 0 ? `${summary}: ${detail}` : summary,
      createdAt: recordedAt
    }]);

    return this.buildViewRecord(
      updated,
      event ? [event] : [],
      [operation]
    );
  }

  async recordProjectDatabaseBackupArtifact(input: {
    projectId: string;
    databaseId: string;
    label: string;
    storageProvider: ProjectDatabaseBackupArtifactStorageProvider;
    location: string;
    sizeBytes: number | null;
    producedAt: Date;
    retentionExpiresAt: Date | null;
    integrityStatus?: ProjectDatabaseBackupArtifactIntegrityStatus;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseBackupArtifactNotAllowedError();
    }

    const artifact = await this.projectDatabasesRepository.createBackupArtifact({
      projectId: input.projectId,
      databaseId: input.databaseId,
      label: input.label.trim(),
      storageProvider: input.storageProvider,
      location: input.location.trim(),
      sizeBytes: input.sizeBytes,
      producedAt: input.producedAt,
      retentionExpiresAt: input.retentionExpiresAt,
      integrityStatus: input.integrityStatus ?? 'unknown',
      lifecycleStatus: 'active',
      verifiedAt: input.integrityStatus === 'verified' ? new Date() : null,
      lifecycleChangedAt: new Date(),
      detail: input.detail?.trim() ?? ''
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'backup_artifact',
      previousStatus: null,
      nextStatus:
        artifact.integrityStatus === 'verified'
          ? 'verified'
          : artifact.integrityStatus === 'failed'
            ? 'failed'
            : 'recorded',
      detail:
        artifact.detail.trim().length > 0
          ? `Recorded backup artifact "${artifact.label}" at ${artifact.location}: ${artifact.detail}`
          : `Recorded backup artifact "${artifact.label}" at ${artifact.location}`,
      createdAt: new Date()
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.buildViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async updateProjectDatabaseBackupArtifact(input: {
    projectId: string;
    databaseId: string;
    backupArtifactId: string;
    integrityStatus: ProjectDatabaseBackupArtifactIntegrityStatus;
    lifecycleStatus: ProjectDatabaseBackupArtifactLifecycleStatus;
    retentionExpiresAt: Date | null;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findBackupArtifactById(
      input.projectId,
      input.databaseId,
      input.backupArtifactId
    );
    if (!existing) {
      throw new ProjectDatabaseBackupArtifactNotFoundError();
    }

    const detail = input.detail?.trim() ?? '';
    const now = new Date();
    const updated = await this.projectDatabasesRepository.updateBackupArtifact({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupArtifactId: input.backupArtifactId,
      integrityStatus: input.integrityStatus,
      lifecycleStatus: input.lifecycleStatus,
      retentionExpiresAt: input.retentionExpiresAt,
      verifiedAt:
        input.integrityStatus === 'verified'
          ? existing.verifiedAt ?? now
          : existing.verifiedAt,
      lifecycleChangedAt:
        input.lifecycleStatus === existing.lifecycleStatus
          ? existing.lifecycleChangedAt
          : now,
      detail
    });

    if (!updated) {
      throw new ProjectDatabaseBackupArtifactNotFoundError();
    }

    const changedParts: string[] = [];
    if (existing.integrityStatus !== updated.integrityStatus) {
      changedParts.push(`integrity ${existing.integrityStatus} -> ${updated.integrityStatus}`);
    }
    if (existing.lifecycleStatus !== updated.lifecycleStatus) {
      changedParts.push(`lifecycle ${existing.lifecycleStatus} -> ${updated.lifecycleStatus}`);
    }
    if (
      (existing.retentionExpiresAt?.toISOString() ?? null)
      !== (updated.retentionExpiresAt?.toISOString() ?? null)
    ) {
      changedParts.push(
        updated.retentionExpiresAt
          ? `retention now expires ${updated.retentionExpiresAt.toISOString()}`
          : 'retention expiry cleared'
      );
    }
    if (existing.detail !== updated.detail && detail.length > 0) {
      changedParts.push(`notes: ${detail}`);
    }

    if (changedParts.length > 0) {
      await this.projectDatabasesRepository.createEvents([{
        projectId: input.projectId,
        databaseId: input.databaseId,
        kind: 'backup_artifact',
        previousStatus: `${existing.lifecycleStatus}:${existing.integrityStatus}`,
        nextStatus: `${updated.lifecycleStatus}:${updated.integrityStatus}`,
        detail: `Updated backup artifact "${updated.label}": ${changedParts.join('; ')}`,
        createdAt: now
      }]);
    }

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.buildViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async createProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    backupArtifactId?: string | null;
    target: string;
    summary: string;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.backupMode !== 'external' || record.backupRunbook.trim().length === 0) {
      throw new ProjectDatabaseRestoreRequestNotAllowedError();
    }

    let backupArtifact: ProjectDatabaseBackupArtifactRecord | null = null;
    if (input.backupArtifactId) {
      backupArtifact = await this.projectDatabasesRepository.findBackupArtifactById(
        input.projectId,
        input.databaseId,
        input.backupArtifactId
      );

      if (!backupArtifact) {
        throw new ProjectDatabaseBackupArtifactNotFoundError();
      }

      if (!isBackupArtifactRestorable(backupArtifact)) {
        throw new ProjectDatabaseBackupArtifactUnavailableError();
      }
    }

    const request = await this.projectDatabasesRepository.createRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      backupArtifactId: backupArtifact?.id ?? null,
      target: input.target.trim(),
      summary: input.summary.trim(),
      detail: input.detail?.trim() ?? '',
      requestedAt: new Date()
    });

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: null,
      nextStatus: `${request.approvalStatus}:${request.status}`,
      detail:
        request.detail.trim().length > 0
          ? `${request.summary} (${request.target})${request.backupArtifactLabel ? ` using "${request.backupArtifactLabel}"` : ''}: ${request.detail}`
          : `${request.summary} (${request.target})${request.backupArtifactLabel ? ` using "${request.backupArtifactLabel}"` : ''}`,
      createdAt: request.requestedAt
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.buildViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async reviewProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    approvalStatus: ProjectDatabaseRestoreRequestApprovalStatus;
    approvalDetail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findRestoreRequestById(
      input.projectId,
      input.databaseId,
      input.restoreRequestId
    );
    if (!existing) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    if (existing.status !== 'requested') {
      throw new ProjectDatabaseRestoreRequestApprovalNotAllowedError();
    }

    const approvalReviewedAt = new Date();
    const approvalDetail = input.approvalDetail?.trim() ?? '';
    const updated = await this.projectDatabasesRepository.reviewRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      restoreRequestId: input.restoreRequestId,
      approvalStatus: input.approvalStatus,
      approvalDetail,
      approvalReviewedAt
    });

    if (!updated) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: `${existing.approvalStatus}:${existing.status}`,
      nextStatus: `${updated.approvalStatus}:${updated.status}`,
      detail:
        approvalDetail.length > 0
          ? `${updated.summary} (${updated.target}) review: ${approvalDetail}`
          : input.approvalStatus === 'approved'
            ? `Restore request "${updated.summary}" for ${updated.target} was approved for execution.`
            : `Restore request "${updated.summary}" for ${updated.target} was rejected.`,
      createdAt: approvalReviewedAt
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.buildViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async updateProjectDatabaseRestoreRequest(input: {
    projectId: string;
    databaseId: string;
    restoreRequestId: string;
    status: ProjectDatabaseRestoreRequestStatus;
    detail?: string;
  }): Promise<ProjectDatabaseViewRecord> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const existing = await this.projectDatabasesRepository.findRestoreRequestById(
      input.projectId,
      input.databaseId,
      input.restoreRequestId
    );
    if (!existing) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    if (
      (input.status === 'in_progress' || input.status === 'succeeded' || input.status === 'failed')
      && existing.approvalStatus !== 'approved'
    ) {
      throw new ProjectDatabaseRestoreRequestApprovalNotAllowedError();
    }

    const updated = await this.projectDatabasesRepository.updateRestoreRequest({
      projectId: input.projectId,
      databaseId: input.databaseId,
      restoreRequestId: input.restoreRequestId,
      status: input.status,
      detail: input.detail?.trim() ?? '',
      startedAt:
        input.status === 'in_progress'
          ? existing.startedAt ?? new Date()
          : input.status === 'requested'
            ? null
            : existing.startedAt,
      completedAt:
        input.status === 'succeeded' || input.status === 'failed' || input.status === 'cancelled'
          ? new Date()
          : null
    });
    if (!updated) {
      throw new ProjectDatabaseRestoreRequestNotFoundError();
    }

    await this.projectDatabasesRepository.createEvents([{
      projectId: input.projectId,
      databaseId: input.databaseId,
      kind: 'restore_request',
      previousStatus: `${existing.approvalStatus}:${existing.status}`,
      nextStatus: `${updated.approvalStatus}:${updated.status}`,
      detail:
        updated.detail.trim().length > 0
          ? `${updated.summary} (${updated.target})${updated.backupArtifactLabel ? ` using "${updated.backupArtifactLabel}"` : ''}: ${updated.detail}`
          : `${updated.summary} (${updated.target})${updated.backupArtifactLabel ? ` using "${updated.backupArtifactLabel}"` : ''}`,
      createdAt: new Date()
    }]);

    const collections = await this.loadRecentDatabaseCollections(record.id);
    return this.buildViewRecord(
      record,
      collections.recentEvents,
      collections.recentOperations,
      collections.recentBackupArtifacts,
      collections.recentRestoreRequests
    );
  }

  async getProjectDatabaseAuditExport(input: {
    projectId: string;
    databaseId: string;
  }): Promise<ProjectDatabaseAuditExport> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    const [
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    ] = await Promise.all([
      this.projectDatabasesRepository.listRecentEventsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentOperationsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentBackupArtifactsByDatabaseIds([record.id], 50),
      this.projectDatabasesRepository.listRecentRestoreRequestsByDatabaseIds([record.id], 50)
    ]);

    const database = this.buildViewRecord(
      record,
      recentEvents,
      recentOperations,
      recentBackupArtifacts,
      recentRestoreRequests
    );

    return {
      exportedAt: new Date(),
      database,
      events: database.recentEvents,
      operations: database.recentOperations,
      backupArtifacts: database.backupArtifacts,
      restoreRequests: database.restoreRequests
    };
  }

  async updateProjectDatabaseServiceLinks(input: {
    projectId: string;
    databaseId: string;
    serviceNames: string[];
  }): Promise<ProjectDatabaseViewRecord> {
    const project = await this.requireProject(input.projectId);
    const validatedServiceNames = this.validateServiceNames(project, input.serviceNames);
    const updated = await this.projectDatabasesRepository.replaceServiceLinks({
      projectId: input.projectId,
      databaseId: input.databaseId,
      serviceNames: validatedServiceNames
    });

    if (!updated) {
      throw new ProjectDatabaseNotFoundError();
    }

    return this.buildViewRecord(updated);
  }

  async removeProjectDatabase(input: {
    projectId: string;
    databaseId: string;
  }): Promise<void> {
    await this.requireProject(input.projectId);
    const record = await this.projectDatabasesRepository.findById(input.projectId, input.databaseId);
    if (!record) {
      throw new ProjectDatabaseNotFoundError();
    }

    if (record.provisionedAt || record.status === 'ready') {
      try {
        await this.managedPostgresProvisioner.deprovision({
          databaseName: record.databaseName,
          username: record.username
        });
      } catch {
        throw new ProjectDatabaseDeprovisioningFailedError();
      }
    }

    const deleted = await this.projectDatabasesRepository.delete(input.projectId, input.databaseId);
    if (!deleted) {
      throw new ProjectDatabaseNotFoundError();
    }
  }

  async listInjectedEnvironmentForProjectService(input: {
    projectId: string;
    serviceName: string;
  }): Promise<Record<string, string>> {
    const records = await this.projectDatabasesRepository.listLinkedReadyByProjectService(
      input.projectId,
      input.serviceName
    );

    return records.reduce<Record<string, string>>((envVars, record) => {
      if (!record.connectionHost || !record.connectionPort || !record.connectionSslMode) {
        return envVars;
      }

      const password = this.cryptoService.decrypt(record.encryptedPassword);
      const generatedEnvironment = createManagedPostgresEnvKeys(record.name);
      const connectionString = buildManagedPostgresConnectionString({
        host: record.connectionHost,
        port: record.connectionPort,
        databaseName: record.databaseName,
        username: record.username,
        password,
        sslMode: record.connectionSslMode
      });

      return {
        ...envVars,
        [generatedEnvironment.databaseUrlKey]: connectionString,
        [generatedEnvironment.hostKey]: record.connectionHost,
        [generatedEnvironment.portKey]: String(record.connectionPort),
        [generatedEnvironment.databaseNameKey]: record.databaseName,
        [generatedEnvironment.usernameKey]: record.username,
        [generatedEnvironment.passwordKey]: password
      };
    }, {});
  }
}
