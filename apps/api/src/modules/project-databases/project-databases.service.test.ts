import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultProjectServices } from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const {
  InvalidProjectServiceError,
  ProjectDatabaseCredentialRotationNotAllowedError,
  ProjectDatabaseDeprovisioningFailedError
} = await import('../../server/domain-errors.js');
const { ProjectDatabasesService } = await import('./project-databases.service.js');

const project = {
  id: 'project-1',
  userId: 'user-1',
  slug: 'example-project',
  services: createDefaultProjectServices()
};

function createProjectDatabaseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'db-1',
    projectId: project.id,
    engine: 'postgres',
    name: 'primary-db',
    status: 'ready',
    statusDetail: 'Managed Postgres is provisioned.',
    databaseName: 'db_example_primary_abc123',
    username: 'user_example_primary_abc123',
    encryptedPassword: 'enc:secret-pass',
    connectionHost: 'postgres',
    connectionPort: 5432,
    connectionSslMode: 'disable',
    healthStatus: 'healthy',
    healthStatusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
    healthStatusChangedAt: new Date('2026-03-29T12:01:00.000Z'),
    lastHealthCheckAt: new Date('2026-03-29T12:01:00.000Z'),
    lastHealthyAt: new Date('2026-03-29T12:01:00.000Z'),
    lastHealthErrorAt: null,
    consecutiveHealthCheckFailures: 0,
    credentialsRotatedAt: null,
    provisionedAt: new Date('2026-03-29T12:01:00.000Z'),
    lastProvisioningAttemptAt: new Date('2026-03-29T12:01:00.000Z'),
    lastErrorAt: null,
    createdAt: new Date('2026-03-29T12:00:00.000Z'),
    updatedAt: new Date('2026-03-29T12:01:00.000Z'),
    serviceNames: ['app'],
    ...overrides
  };
}

test('createProjectDatabase provisions a managed postgres resource, records runtime health, and returns generated env details', async () => {
  let capturedCreateInput: Record<string, unknown> | null = null;
  let capturedOperationalUpdate: Record<string, unknown> | null = null;

  const service = new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project
    } as never,
    projectDatabasesRepository: {
      create: async (input: Record<string, unknown>) => {
        capturedCreateInput = input;
        return createProjectDatabaseRecord({
          name: input.name,
          status: input.status,
          statusDetail: input.statusDetail,
          databaseName: input.databaseName,
          username: input.username,
          encryptedPassword: input.encryptedPassword,
          connectionHost: null,
          connectionPort: null,
          connectionSslMode: null,
          healthStatus: 'unknown',
          healthStatusDetail: 'Health checks have not run yet.',
          healthStatusChangedAt: null,
          lastHealthCheckAt: null,
          lastHealthyAt: null,
          lastHealthErrorAt: null,
          consecutiveHealthCheckFailures: 0,
          provisionedAt: null,
          serviceNames: input.serviceNames
        });
      },
      updateOperationalState: async (input: Record<string, unknown>) => {
        capturedOperationalUpdate = input;
        return createProjectDatabaseRecord({
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
          serviceNames: ['app']
        });
      }
    } as never,
    cryptoService: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, '')
    } as never,
    managedPostgresProvisioner: {
      provision: async () => ({
        status: 'ready',
        statusDetail: 'Managed Postgres is provisioned.',
        connectionHost: 'postgres',
        connectionPort: 5432,
        connectionSslMode: 'disable',
        provisionedAt: new Date('2026-03-29T12:01:00.000Z'),
        lastErrorAt: null
      }),
      checkHealth: async () => ({
        status: 'healthy',
        statusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
        checkedAt: new Date('2026-03-29T12:01:30.000Z')
      }),
      rotateCredentials: async () => ({
        status: 'rotated',
        statusDetail: 'rotated',
        rotatedAt: new Date('2026-03-29T12:03:00.000Z'),
        lastErrorAt: null
      }),
      deprovision: async () => undefined
    }
  });

  const created = await service.createProjectDatabase({
    projectId: project.id,
    name: 'primary-db',
    serviceNames: ['app']
  });

  assert.equal(capturedCreateInput?.['name'], 'primary-db');
  assert.deepEqual(capturedCreateInput?.['serviceNames'], ['app']);
  assert.equal(capturedOperationalUpdate?.['healthStatus'], 'healthy');
  assert.equal(created.status, 'ready');
  assert.equal(created.healthStatus, 'healthy');
  assert.equal(created.connectionHost, 'postgres');
  assert.equal(created.generatedEnvironment.databaseUrlKey, 'PRIMARY_DB_DATABASE_URL');
  assert.match(created.connectionString ?? '', /^postgresql:\/\/user_example_primary_abc123:secret-pass@postgres:5432\/db_example_primary_abc123\?sslmode=disable$/);
});

test('createProjectDatabase rejects unknown service links', async () => {
  const service = new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project
    } as never,
    projectDatabasesRepository: {} as never
  });

  await assert.rejects(
    service.createProjectDatabase({
      projectId: project.id,
      name: 'primary-db',
      serviceNames: ['missing-service']
    }),
    InvalidProjectServiceError
  );
});

test('rotateProjectDatabaseCredentials reprovisions with a new password and persists rotation metadata', async () => {
  let capturedOperationalUpdate: Record<string, unknown> | null = null;

  const service = new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project
    } as never,
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord(),
      updateOperationalState: async (input: Record<string, unknown>) => {
        capturedOperationalUpdate = input;
        return createProjectDatabaseRecord({
          encryptedPassword: input.encryptedPassword,
          status: input.status,
          statusDetail: input.statusDetail,
          healthStatus: input.healthStatus,
          healthStatusDetail: input.healthStatusDetail,
          healthStatusChangedAt: input.healthStatusChangedAt,
          lastHealthCheckAt: input.lastHealthCheckAt,
          lastHealthyAt: input.lastHealthyAt,
          lastHealthErrorAt: input.lastHealthErrorAt,
          consecutiveHealthCheckFailures: input.consecutiveHealthCheckFailures,
          credentialsRotatedAt: input.credentialsRotatedAt,
          lastProvisioningAttemptAt: input.lastProvisioningAttemptAt
        });
      }
    } as never,
    cryptoService: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, '')
    } as never,
    managedPostgresProvisioner: {
      provision: async () => ({
        status: 'ready',
        statusDetail: 'Managed Postgres is provisioned.',
        connectionHost: 'postgres',
        connectionPort: 5432,
        connectionSslMode: 'disable',
        provisionedAt: new Date('2026-03-29T12:01:00.000Z'),
        lastErrorAt: null
      }),
      checkHealth: async (input) => ({
        status: 'healthy',
        statusDetail: `Managed Postgres accepted rotated credentials for ${input.username}.`,
        checkedAt: new Date('2026-03-29T12:08:30.000Z')
      }),
      rotateCredentials: async () => ({
        status: 'rotated',
        statusDetail: 'Managed Postgres credentials were rotated successfully. Redeploy linked services so they receive the new generated password.',
        rotatedAt: new Date('2026-03-29T12:08:00.000Z'),
        lastErrorAt: null
      }),
      deprovision: async () => undefined
    }
  });

  const rotated = await service.rotateProjectDatabaseCredentials({
    projectId: project.id,
    databaseId: 'db-1'
  });

  assert.match(String(capturedOperationalUpdate?.['encryptedPassword']), /^enc:/);
  assert.equal((capturedOperationalUpdate?.['credentialsRotatedAt'] as Date | undefined) instanceof Date, true);
  assert.equal(rotated.credentialsRotatedAt?.toISOString(), '2026-03-29T12:08:00.000Z');
  assert.equal(rotated.healthStatus, 'healthy');
});

test('rotateProjectDatabaseCredentials rejects databases that are not ready', async () => {
  const service = new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project
    } as never,
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        status: 'pending_config',
        connectionHost: null,
        connectionPort: null,
        connectionSslMode: null
      })
    } as never
  });

  await assert.rejects(
    service.rotateProjectDatabaseCredentials({
      projectId: project.id,
      databaseId: 'db-1'
    }),
    ProjectDatabaseCredentialRotationNotAllowedError
  );
});

test('listInjectedEnvironmentForProjectService returns generated credentials for linked ready databases', async () => {
  const service = new ProjectDatabasesService({} as never, {
    projectDatabasesRepository: {
      listLinkedReadyByProjectService: async () => ([
        createProjectDatabaseRecord()
      ])
    } as never,
    cryptoService: {
      decrypt: (value: string) => value.replace(/^enc:/, '')
    } as never,
    projectsRepository: {} as never
  });

  const envVars = await service.listInjectedEnvironmentForProjectService({
    projectId: project.id,
    serviceName: 'app'
  });

  assert.deepEqual(envVars, {
    PRIMARY_DB_DATABASE_URL: 'postgresql://user_example_primary_abc123:secret-pass@postgres:5432/db_example_primary_abc123?sslmode=disable',
    PRIMARY_DB_DATABASE_HOST: 'postgres',
    PRIMARY_DB_DATABASE_PORT: '5432',
    PRIMARY_DB_DATABASE_NAME: 'db_example_primary_abc123',
    PRIMARY_DB_DATABASE_USER: 'user_example_primary_abc123',
    PRIMARY_DB_DATABASE_PASSWORD: 'secret-pass'
  });
});

test('removeProjectDatabase surfaces deprovision failures for provisioned resources', async () => {
  const service = new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project
    } as never,
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord(),
      delete: async () => true
    } as never,
    managedPostgresProvisioner: {
      provision: async () => ({
        status: 'ready',
        statusDetail: 'Ready',
        connectionHost: 'postgres',
        connectionPort: 5432,
        connectionSslMode: 'disable',
        provisionedAt: new Date(),
        lastErrorAt: null
      }),
      checkHealth: async () => ({
        status: 'healthy',
        statusDetail: 'ok',
        checkedAt: new Date()
      }),
      rotateCredentials: async () => ({
        status: 'rotated',
        statusDetail: 'rotated',
        rotatedAt: new Date(),
        lastErrorAt: null
      }),
      deprovision: async () => {
        throw new Error('drop database failed');
      }
    }
  });

  await assert.rejects(
    service.removeProjectDatabase({
      projectId: project.id,
      databaseId: 'db-1'
    }),
    ProjectDatabaseDeprovisioningFailedError
  );
});
