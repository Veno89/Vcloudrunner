import { randomBytes } from 'node:crypto';
import {
  createManagedPostgresEnvKeys,
  getProjectServiceByName,
  normalizeProjectServices
} from '@vcloudrunner/shared-types';

import type { DbClient } from '../../db/client.js';
import {
  InvalidProjectServiceError,
  ProjectDatabaseAlreadyExistsError,
  ProjectDatabaseCredentialRotationFailedError,
  ProjectDatabaseCredentialRotationNotAllowedError,
  ProjectDatabaseDeprovisioningFailedError,
  ProjectDatabaseNotFoundError,
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
  type ProjectDatabaseHealthStatus,
  type ProjectDatabaseRecord
} from './project-databases.repository.js';

function normalizeManagedDatabaseName(name: string) {
  return name.trim().toLowerCase();
}

function sanitizeIdentifierSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized.length > 0 ? normalized : 'db';
}

function createManagedIdentifier(input: {
  prefix: 'db' | 'user';
  projectSlug: string;
  databaseName: string;
  suffix: string;
}) {
  const projectSlug = sanitizeIdentifierSegment(input.projectSlug);
  const databaseName = sanitizeIdentifierSegment(input.databaseName);
  const suffix = sanitizeIdentifierSegment(input.suffix);
  const maxBaseLength = 63 - input.prefix.length - suffix.length - 2;
  const base = `${projectSlug}_${databaseName}`.slice(0, Math.max(8, maxBaseLength)).replace(/_+$/g, '');

  return `${input.prefix}_${base}_${suffix}`.slice(0, 63);
}

function isProjectDatabaseNameUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as { code?: string; constraint?: string };
  return pgError.code === '23505' && (
    pgError.constraint === 'project_databases_project_name_unique'
    || pgError.constraint === 'project_databases_database_name_unique'
    || pgError.constraint === 'project_databases_username_unique'
  );
}

interface ProjectDatabaseHealthSnapshot {
  healthStatus: ProjectDatabaseHealthStatus;
  healthStatusDetail: string;
  healthStatusChangedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthyAt: Date | null;
  lastHealthErrorAt: Date | null;
  consecutiveHealthCheckFailures: number;
}

export interface ProjectDatabaseViewRecord {
  id: string;
  projectId: string;
  engine: 'postgres';
  name: string;
  status: 'pending_config' | 'provisioning' | 'ready' | 'failed';
  statusDetail: string;
  databaseName: string;
  username: string;
  password: string;
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
  connectionString: string | null;
  provisionedAt: Date | null;
  lastProvisioningAttemptAt: Date | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  serviceNames: string[];
  generatedEnvironment: ReturnType<typeof createManagedPostgresEnvKeys>;
}

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

  private toViewRecord(record: ProjectDatabaseRecord): ProjectDatabaseViewRecord {
    const password = this.cryptoService.decrypt(record.encryptedPassword);
    const generatedEnvironment = createManagedPostgresEnvKeys(record.name);
    const connectionString =
      record.connectionHost && record.connectionPort && record.connectionSslMode
        ? buildManagedPostgresConnectionString({
            host: record.connectionHost,
            port: record.connectionPort,
            databaseName: record.databaseName,
            username: record.username,
            password,
            sslMode: record.connectionSslMode
          })
        : null;

    return {
      ...record,
      password,
      connectionString,
      generatedEnvironment
    };
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

  private createUnknownHealthSnapshot(record: ProjectDatabaseRecord, detail: string): ProjectDatabaseHealthSnapshot {
    const changedAt = record.healthStatus === 'unknown'
      ? record.healthStatusChangedAt
      : new Date();

    return {
      healthStatus: 'unknown',
      healthStatusDetail: detail,
      healthStatusChangedAt: changedAt,
      lastHealthCheckAt: record.lastHealthCheckAt,
      lastHealthyAt: record.lastHealthyAt,
      lastHealthErrorAt: record.lastHealthErrorAt,
      consecutiveHealthCheckFailures: 0
    };
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
      return this.createUnknownHealthSnapshot(
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
      return this.createUnknownHealthSnapshot(input.record, healthResult.statusDetail);
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

    return updated;
  }

  async listProjectDatabases(projectId: string): Promise<ProjectDatabaseViewRecord[]> {
    await this.requireProject(projectId);
    const records = await this.projectDatabasesRepository.listByProject(projectId);
    return records.map((record) => this.toViewRecord(record));
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
    return this.toViewRecord(provisioned);
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
    return this.toViewRecord(provisioned);
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

    return this.toViewRecord(rotated);
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

    return this.toViewRecord(updated);
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
