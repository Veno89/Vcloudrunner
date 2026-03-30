import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultProjectServices } from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const {
  ProjectDatabaseBackupArtifactNotAllowedError,
  ProjectDatabaseBackupArtifactUnavailableError,
  InvalidProjectServiceError,
  ProjectDatabaseCredentialRotationNotAllowedError,
  ProjectDatabaseDeprovisioningFailedError,
  ProjectDatabaseRecoveryCheckNotAllowedError,
  ProjectDatabaseRestoreRequestApprovalNotAllowedError,
  ProjectDatabaseRestoreRequestNotFoundError
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
    backupMode: 'none',
    backupSchedule: null,
    backupRunbook: '',
    backupVerifiedAt: null,
    restoreVerifiedAt: null,
    provisionedAt: new Date('2026-03-29T12:01:00.000Z'),
    lastProvisioningAttemptAt: new Date('2026-03-29T12:01:00.000Z'),
    lastErrorAt: null,
    createdAt: new Date('2026-03-29T12:00:00.000Z'),
    updatedAt: new Date('2026-03-29T12:01:00.000Z'),
    serviceNames: ['app'],
    ...overrides
  };
}

function createProjectDatabaseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    projectId: project.id,
    databaseId: 'db-1',
    kind: 'runtime_health',
    previousStatus: 'unknown',
    nextStatus: 'healthy',
    detail: 'Health check passed.',
    createdAt: new Date('2026-03-29T12:02:00.000Z'),
    ...overrides
  };
}

function createProjectDatabaseOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'operation-1',
    projectId: project.id,
    databaseId: 'db-1',
    kind: 'backup',
    status: 'succeeded',
    summary: 'Nightly backup completed successfully.',
    detail: '',
    recordedAt: new Date('2026-03-29T12:03:00.000Z'),
    ...overrides
  };
}

function createProjectDatabaseBackupArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'artifact-1',
    projectId: project.id,
    databaseId: 'db-1',
    label: 'nightly-2026-03-29',
    storageProvider: 's3',
    location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-29.dump',
    sizeBytes: 512 * 1024 * 1024,
    producedAt: new Date('2026-03-29T12:03:00.000Z'),
    retentionExpiresAt: new Date('2026-04-05T12:03:00.000Z'),
    integrityStatus: 'verified',
    lifecycleStatus: 'active',
    verifiedAt: new Date('2026-03-29T12:04:00.000Z'),
    lifecycleChangedAt: new Date('2026-03-29T12:04:00.000Z'),
    detail: 'Checksum verified against object storage.',
    createdAt: new Date('2026-03-29T12:04:00.000Z'),
    updatedAt: new Date('2026-03-29T12:04:00.000Z'),
    ...overrides
  };
}

function createProjectDatabaseRestoreRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'restore-request-1',
    projectId: project.id,
    databaseId: 'db-1',
    backupArtifactId: 'artifact-1',
    backupArtifactLabel: 'nightly-2026-03-29',
    status: 'requested',
    approvalStatus: 'pending',
    approvalDetail: '',
    approvalReviewedAt: null,
    target: 'staging verification environment',
    summary: 'Verify restore before schema migration.',
    detail: 'Operator is preparing a disposable validation target.',
    requestedAt: new Date('2026-03-29T12:06:00.000Z'),
    startedAt: null,
    completedAt: null,
    createdAt: new Date('2026-03-29T12:06:00.000Z'),
    updatedAt: new Date('2026-03-29T12:06:00.000Z'),
    ...overrides
  };
}

function createService(
  overrides: {
    projectsRepository?: Record<string, unknown>;
    projectDatabasesRepository?: Record<string, unknown>;
    cryptoService?: Record<string, unknown>;
    managedPostgresProvisioner?: Record<string, unknown>;
  } = {}
) {
  return new ProjectDatabasesService({} as never, {
    projectsRepository: {
      findById: async () => project,
      ...overrides.projectsRepository
    } as never,
    projectDatabasesRepository: {
      listByProject: async () => [],
      listRecentEventsByDatabaseIds: async () => [],
      create: async () => createProjectDatabaseRecord({
        status: 'provisioning',
        statusDetail: 'Provisioning managed Postgres credentials and database resources.',
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
        provisionedAt: null
      }),
      findById: async () => createProjectDatabaseRecord(),
      updateOperationalState: async () => createProjectDatabaseRecord(),
      updateBackupPolicy: async () => createProjectDatabaseRecord(),
      recordRecoveryCheck: async () => createProjectDatabaseRecord(),
      createOperation: async () => createProjectDatabaseOperation(),
      createBackupArtifact: async () => createProjectDatabaseBackupArtifact(),
      findBackupArtifactById: async () => createProjectDatabaseBackupArtifact(),
      updateBackupArtifact: async () => createProjectDatabaseBackupArtifact(),
      createRestoreRequest: async () => createProjectDatabaseRestoreRequest(),
      findRestoreRequestById: async () => createProjectDatabaseRestoreRequest(),
      reviewRestoreRequest: async () => createProjectDatabaseRestoreRequest(),
      updateRestoreRequest: async () => createProjectDatabaseRestoreRequest(),
      replaceServiceLinks: async () => createProjectDatabaseRecord(),
      createEvents: async () => [],
      listLinkedReadyByProjectService: async () => [],
      listRecentBackupArtifactsByDatabaseIds: async () => [],
      listRecentOperationsByDatabaseIds: async () => [],
      listRecentRestoreRequestsByDatabaseIds: async () => [],
      delete: async () => true,
      ...overrides.projectDatabasesRepository
    } as never,
    cryptoService: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, ''),
      ...overrides.cryptoService
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
        statusDetail: 'Managed Postgres credentials were rotated successfully. Redeploy linked services so they receive the new generated password.',
        rotatedAt: new Date('2026-03-29T12:08:00.000Z'),
        lastErrorAt: null
      }),
      deprovision: async () => undefined,
      ...overrides.managedPostgresProvisioner
    } as never
  });
}

test('createProjectDatabase provisions managed postgres, records runtime health, and persists events', async () => {
  let capturedCreateInput: Record<string, unknown> | null = null;
  let capturedOperationalUpdate: Record<string, unknown> | null = null;
  let capturedEvents: unknown[] | null = null;

  const service = createService({
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
      },
      createEvents: async (events: unknown[]) => {
        capturedEvents = events;
        return [];
      }
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
  assert.equal(Array.isArray(capturedEvents), true);
});

test('createProjectDatabase rejects unknown service links', async () => {
  const service = createService();

  await assert.rejects(
    service.createProjectDatabase({
      projectId: project.id,
      name: 'primary-db',
      serviceNames: ['missing-service']
    }),
    InvalidProjectServiceError
  );
});

test('listProjectDatabases returns backup coverage, inventory, restore workflow, and grouped history', async () => {
  const service = createService({
    projectDatabasesRepository: {
      listByProject: async () => [
        createProjectDatabaseRecord({
          backupMode: 'external',
          backupSchedule: 'weekly',
          backupRunbook: 'Nightly pg_dump plus quarterly restore drill.',
          backupVerifiedAt: new Date('2026-03-29T12:04:00.000Z')
        })
      ],
      listRecentEventsByDatabaseIds: async () => [
        createProjectDatabaseEvent(),
        createProjectDatabaseEvent({
          id: 'event-2',
          kind: 'backup_policy',
          previousStatus: 'missing',
          nextStatus: 'backup-verified',
          detail: 'External backup coverage is documented and verification has been recorded.'
        })
      ],
      listRecentOperationsByDatabaseIds: async () => [
        createProjectDatabaseOperation({
          kind: 'backup',
          status: 'succeeded',
          summary: 'Nightly backup completed successfully.',
          recordedAt: new Date('2026-03-29T12:04:00.000Z')
        }),
        createProjectDatabaseOperation({
          id: 'operation-2',
          kind: 'restore',
          status: 'failed',
          summary: 'Restore drill failed to reach the restore target.',
          detail: 'Operator is retrying after fixing network access.',
          recordedAt: new Date('2026-03-29T12:05:00.000Z')
        })
      ],
      listRecentBackupArtifactsByDatabaseIds: async () => [
        createProjectDatabaseBackupArtifact()
      ],
      listRecentRestoreRequestsByDatabaseIds: async () => [
        createProjectDatabaseRestoreRequest()
      ]
    }
  });

  const databases = await service.listProjectDatabases(project.id);

  assert.equal(databases.length, 1);
  assert.equal(databases[0]?.backupCoverage.status, 'backup-verified');
  assert.equal(databases[0]?.backupExecution.status, 'scheduled');
  assert.equal(databases[0]?.restoreExercise.status, 'attention');
  assert.equal(databases[0]?.backupInventory.status, 'verified');
  assert.equal(databases[0]?.restoreWorkflow.status, 'awaiting-approval');
  assert.equal(databases[0]?.recentEvents.length, 2);
  assert.equal(databases[0]?.recentOperations.length, 2);
  assert.equal(databases[0]?.backupArtifacts.length, 1);
  assert.equal(databases[0]?.restoreRequests.length, 1);
  assert.equal(databases[0]?.recentOperations[0]?.kind, 'backup');
  assert.equal(databases[0]?.recentOperations[1]?.status, 'failed');
  assert.equal(databases[0]?.recentEvents[1]?.kind, 'backup_policy');
});

test('rotateProjectDatabaseCredentials reprovisions with a new password and records a credentials event', async () => {
  let capturedOperationalUpdate: Record<string, unknown> | null = null;
  let capturedEvents: unknown[] | null = null;

  const service = createService({
    projectDatabasesRepository: {
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
      },
      createEvents: async (events: unknown[]) => {
        capturedEvents = events;
        return [];
      }
    },
    managedPostgresProvisioner: {
      checkHealth: async (input: Record<string, unknown>) => ({
        status: 'healthy',
        statusDetail: `Managed Postgres accepted rotated credentials for ${input.username}.`,
        checkedAt: new Date('2026-03-29T12:08:30.000Z')
      })
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
  assert.equal(Array.isArray(capturedEvents), true);
});

test('rotateProjectDatabaseCredentials rejects databases that are not ready', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        status: 'pending_config',
        connectionHost: null,
        connectionPort: null,
        connectionSslMode: null
      })
    }
  });

  await assert.rejects(
    service.rotateProjectDatabaseCredentials({
      projectId: project.id,
      databaseId: 'db-1'
    }),
    ProjectDatabaseCredentialRotationNotAllowedError
  );
});

test('updateProjectDatabaseBackupPolicy persists backup coverage and records an event when status changes', async () => {
  let capturedPolicyInput: Record<string, unknown> | null = null;
  let capturedEvents: unknown[] | null = null;

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord(),
      updateBackupPolicy: async (input: Record<string, unknown>) => {
        capturedPolicyInput = input;
        return createProjectDatabaseRecord({
          backupMode: input.backupMode,
          backupSchedule: input.backupSchedule,
          backupRunbook: input.backupRunbook
        });
      },
      createEvents: async (events: unknown[]) => {
        capturedEvents = events;
        return [];
      }
    }
  });

  const updated = await service.updateProjectDatabaseBackupPolicy({
    projectId: project.id,
    databaseId: 'db-1',
    backupMode: 'external',
    backupSchedule: 'weekly',
    backupRunbook: 'Weekly snapshot with quarterly restore drill.'
  });

  assert.deepEqual(capturedPolicyInput, {
    projectId: project.id,
    databaseId: 'db-1',
    backupMode: 'external',
    backupSchedule: 'weekly',
    backupRunbook: 'Weekly snapshot with quarterly restore drill.'
  });
  assert.equal(updated.backupCoverage.status, 'documented');
  assert.equal(Array.isArray(capturedEvents), true);
});

test('recordProjectDatabaseRecoveryCheck requires an external runbook before verification can be recorded', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'none',
        backupRunbook: ''
      })
    }
  });

  await assert.rejects(
    service.recordProjectDatabaseRecoveryCheck({
      projectId: project.id,
      databaseId: 'db-1',
      kind: 'restore'
    }),
    ProjectDatabaseRecoveryCheckNotAllowedError
  );
});

test('recordProjectDatabaseRecoveryCheck records successful operations, verification timestamps, and events', async () => {
  let capturedRecoveryInput: Record<string, unknown> | null = null;
  let capturedOperationInput: Record<string, unknown> | null = null;
  let capturedEvents: unknown[] | null = null;

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      recordRecoveryCheck: async (input: Record<string, unknown>) => {
        capturedRecoveryInput = input;
        return createProjectDatabaseRecord({
          backupMode: 'external',
          backupSchedule: 'daily',
          backupRunbook: 'Nightly pg_dump plus restore runbook.',
          restoreVerifiedAt: input.kind === 'restore' ? input.verifiedAt : null,
          backupVerifiedAt: input.kind === 'backup' ? input.verifiedAt : null
        });
      },
      createOperation: async (input: Record<string, unknown>) => {
        capturedOperationInput = input;
        return createProjectDatabaseOperation({
          kind: input.kind,
          status: input.status,
          summary: input.summary,
          detail: input.detail,
          recordedAt: input.recordedAt
        });
      },
      createEvents: async (events: unknown[]) => {
        capturedEvents = events;
        return [createProjectDatabaseEvent({
          kind: 'restore_operation',
          nextStatus: 'succeeded',
          detail: 'External restore drill completed successfully.',
          createdAt: new Date('2026-03-29T12:06:00.000Z')
        })];
      }
    }
  });

  const updated = await service.recordProjectDatabaseRecoveryCheck({
    projectId: project.id,
    databaseId: 'db-1',
    kind: 'restore',
    status: 'succeeded',
    summary: 'External restore drill completed successfully.',
    detail: 'Operator restored into a disposable verification target.'
  });

  assert.equal(capturedRecoveryInput?.['kind'], 'restore');
  assert.equal(capturedOperationInput?.['kind'], 'restore');
  assert.equal(capturedOperationInput?.['status'], 'succeeded');
  assert.equal(capturedOperationInput?.['summary'], 'External restore drill completed successfully.');
  assert.equal(updated.backupCoverage.status, 'recovery-verified');
  assert.equal(updated.restoreExercise.status, 'verified');
  assert.equal(updated.recentOperations.length, 1);
  assert.equal(updated.recentOperations[0]?.kind, 'restore');
  assert.equal(updated.recentEvents[0]?.kind, 'restore_operation');
  assert.equal(Array.isArray(capturedEvents), true);
});

test('recordProjectDatabaseRecoveryCheck records failed operations without mutating verification checkpoints', async () => {
  let recordRecoveryCheckCalled = false;
  let capturedOperationInput: Record<string, unknown> | null = null;

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      recordRecoveryCheck: async () => {
        recordRecoveryCheckCalled = true;
        return createProjectDatabaseRecord();
      },
      createOperation: async (input: Record<string, unknown>) => {
        capturedOperationInput = input;
        return createProjectDatabaseOperation({
          kind: input.kind,
          status: input.status,
          summary: input.summary,
          detail: input.detail,
          recordedAt: input.recordedAt
        });
      },
      createEvents: async () => [createProjectDatabaseEvent({
        kind: 'backup_operation',
        nextStatus: 'failed',
        detail: 'External backup run failed: Snapshot target disk was full.',
        createdAt: new Date('2026-03-29T12:07:00.000Z')
      })]
    }
  });

  const updated = await service.recordProjectDatabaseRecoveryCheck({
    projectId: project.id,
    databaseId: 'db-1',
    kind: 'backup',
    status: 'failed',
    summary: 'External backup run failed',
    detail: 'Snapshot target disk was full.'
  });

  assert.equal(recordRecoveryCheckCalled, false);
  assert.equal(capturedOperationInput?.['kind'], 'backup');
  assert.equal(capturedOperationInput?.['status'], 'failed');
  assert.equal(updated.backupVerifiedAt, null);
  assert.equal(updated.backupExecution.status, 'attention');
  assert.equal(updated.restoreExercise.status, 'not-recorded');
  assert.equal(updated.recentOperations.length, 1);
  assert.equal(updated.recentOperations[0]?.status, 'failed');
  assert.equal(updated.recentEvents[0]?.kind, 'backup_operation');
});

test('recordProjectDatabaseBackupArtifact requires an external runbook before artifacts can be recorded', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'none',
        backupRunbook: ''
      })
    }
  });

  await assert.rejects(
    service.recordProjectDatabaseBackupArtifact({
      projectId: project.id,
      databaseId: 'db-1',
      label: 'nightly-2026-03-29',
      storageProvider: 's3',
      location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-29.dump',
      sizeBytes: 512 * 1024 * 1024,
      producedAt: new Date('2026-03-29T12:03:00.000Z'),
      retentionExpiresAt: new Date('2026-04-05T12:03:00.000Z'),
      integrityStatus: 'verified'
    }),
    ProjectDatabaseBackupArtifactNotAllowedError
  );
});

test('recordProjectDatabaseBackupArtifact persists artifacts and emits inventory events', async () => {
  let capturedArtifactInput: Record<string, unknown> | null = null;
  let capturedEventsInput: Record<string, unknown>[] = [];

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      createBackupArtifact: async (input: Record<string, unknown>) => {
        capturedArtifactInput = input;
        return createProjectDatabaseBackupArtifact({
          label: input.label,
          storageProvider: input.storageProvider,
          location: input.location,
          sizeBytes: input.sizeBytes,
          producedAt: input.producedAt,
          retentionExpiresAt: input.retentionExpiresAt,
          integrityStatus: input.integrityStatus,
          detail: input.detail
        });
      },
      createEvents: async (events: Record<string, unknown>[]) => {
        capturedEventsInput = events;
        return [createProjectDatabaseEvent({
          kind: 'backup_artifact',
          nextStatus: 'verified',
          detail: 'Recorded backup artifact "nightly-2026-03-29".',
          createdAt: new Date('2026-03-29T12:04:00.000Z')
        })];
      },
      listRecentEventsByDatabaseIds: async () => [createProjectDatabaseEvent({
        kind: 'backup_artifact',
        nextStatus: 'verified',
        detail: 'Recorded backup artifact "nightly-2026-03-29".',
        createdAt: new Date('2026-03-29T12:04:00.000Z')
      })],
      listRecentBackupArtifactsByDatabaseIds: async () => [createProjectDatabaseBackupArtifact()],
      listRecentRestoreRequestsByDatabaseIds: async () => []
    }
  });

  const updated = await service.recordProjectDatabaseBackupArtifact({
    projectId: project.id,
    databaseId: 'db-1',
    label: 'nightly-2026-03-29',
    storageProvider: 's3',
    location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-29.dump',
    sizeBytes: 512 * 1024 * 1024,
    producedAt: new Date('2026-03-29T12:03:00.000Z'),
    retentionExpiresAt: new Date('2026-04-05T12:03:00.000Z'),
    integrityStatus: 'verified',
    detail: 'Checksum verified against object storage.'
  });

  assert.equal(capturedArtifactInput?.['label'], 'nightly-2026-03-29');
  assert.equal(capturedEventsInput[0]?.['kind'], 'backup_artifact');
  assert.equal(updated.backupInventory.status, 'verified');
  assert.equal(updated.backupArtifacts.length, 1);
  assert.equal(updated.recentEvents[0]?.kind, 'backup_artifact');
});

test('updateProjectDatabaseBackupArtifact persists lifecycle controls and refreshed inventory state', async () => {
  let capturedUpdateInput: Record<string, unknown> | null = null;

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      findBackupArtifactById: async () => createProjectDatabaseBackupArtifact({
        integrityStatus: 'unknown',
        lifecycleStatus: 'active',
        verifiedAt: null
      }),
      updateBackupArtifact: async (input: Record<string, unknown>) => {
        capturedUpdateInput = input;
        return createProjectDatabaseBackupArtifact({
          integrityStatus: input.integrityStatus,
          lifecycleStatus: input.lifecycleStatus,
          retentionExpiresAt: input.retentionExpiresAt,
          verifiedAt: input.verifiedAt,
          detail: input.detail
        });
      },
      listRecentEventsByDatabaseIds: async () => [createProjectDatabaseEvent({
        kind: 'backup_artifact',
        previousStatus: 'active:unknown',
        nextStatus: 'archived:verified',
        detail: 'Updated backup artifact controls.'
      })],
      listRecentBackupArtifactsByDatabaseIds: async () => [createProjectDatabaseBackupArtifact({
        integrityStatus: 'verified',
        lifecycleStatus: 'archived',
        verifiedAt: new Date('2026-03-29T12:10:00.000Z')
      })],
      listRecentRestoreRequestsByDatabaseIds: async () => []
    }
  });

  const updated = await service.updateProjectDatabaseBackupArtifact({
    projectId: project.id,
    databaseId: 'db-1',
    backupArtifactId: 'artifact-1',
    integrityStatus: 'verified',
    lifecycleStatus: 'archived',
    retentionExpiresAt: new Date('2026-04-10T12:03:00.000Z'),
    detail: 'Retained for rollback only.'
  });

  assert.equal(capturedUpdateInput?.['lifecycleStatus'], 'archived');
  assert.equal(capturedUpdateInput?.['integrityStatus'], 'verified');
  assert.equal(updated.backupArtifacts[0]?.lifecycleStatus, 'archived');
  assert.equal(updated.backupInventory.status, 'verified');
});

test('getProjectDatabaseAuditExport returns a long-horizon database audit snapshot', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      listRecentEventsByDatabaseIds: async () => [createProjectDatabaseEvent()],
      listRecentOperationsByDatabaseIds: async () => [createProjectDatabaseOperation()],
      listRecentBackupArtifactsByDatabaseIds: async () => [createProjectDatabaseBackupArtifact()],
      listRecentRestoreRequestsByDatabaseIds: async () => [createProjectDatabaseRestoreRequest()]
    }
  });

  const audit = await service.getProjectDatabaseAuditExport({
    projectId: project.id,
    databaseId: 'db-1'
  });

  assert.equal(audit.database.id, 'db-1');
  assert.equal(audit.events.length, 1);
  assert.equal(audit.operations.length, 1);
  assert.equal(audit.backupArtifacts.length, 1);
  assert.equal(audit.restoreRequests.length, 1);
});

test('createProjectDatabaseRestoreRequest persists restore requests and updateProjectDatabaseRestoreRequest advances status', async () => {
  let capturedCreateInput: Record<string, unknown> | null = null;
  let capturedReviewInput: Record<string, unknown> | null = null;
  let capturedUpdateInput: Record<string, unknown> | null = null;
  let latestRestoreRequest = createProjectDatabaseRestoreRequest();

  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      findBackupArtifactById: async () => createProjectDatabaseBackupArtifact(),
      createRestoreRequest: async (input: Record<string, unknown>) => {
        capturedCreateInput = input;
        latestRestoreRequest = createProjectDatabaseRestoreRequest({
          backupArtifactId: input.backupArtifactId,
          target: input.target,
          summary: input.summary,
          detail: input.detail
        });
        return latestRestoreRequest;
      },
      reviewRestoreRequest: async (input: Record<string, unknown>) => {
        capturedReviewInput = input;
        latestRestoreRequest = createProjectDatabaseRestoreRequest({
          approvalStatus: input.approvalStatus,
          approvalDetail: input.approvalDetail,
          approvalReviewedAt: input.approvalReviewedAt
        });
        return latestRestoreRequest;
      },
      findRestoreRequestById: async () => latestRestoreRequest,
      updateRestoreRequest: async (input: Record<string, unknown>) => {
        capturedUpdateInput = input;
        latestRestoreRequest = createProjectDatabaseRestoreRequest({
          approvalStatus: 'approved',
          status: input.status,
          detail: input.detail,
          startedAt: input.startedAt,
          completedAt: input.completedAt
        });
        return latestRestoreRequest;
      },
      createEvents: async () => [createProjectDatabaseEvent({
        kind: 'restore_request',
        nextStatus: 'requested',
        detail: 'Restore request recorded.',
        createdAt: new Date('2026-03-29T12:06:00.000Z')
      })],
      listRecentBackupArtifactsByDatabaseIds: async () => [createProjectDatabaseBackupArtifact()],
      listRecentRestoreRequestsByDatabaseIds: async () => [latestRestoreRequest]
    }
  });

  const created = await service.createProjectDatabaseRestoreRequest({
    projectId: project.id,
    databaseId: 'db-1',
    backupArtifactId: 'artifact-1',
    target: 'staging verification environment',
    summary: 'Verify restore before schema migration.',
    detail: 'Operator is preparing a disposable validation target.'
  });

  assert.equal(capturedCreateInput?.['backupArtifactId'], 'artifact-1');
  assert.equal(created.restoreWorkflow.status, 'awaiting-approval');
  assert.equal(created.restoreRequests.length, 1);

  const reviewed = await service.reviewProjectDatabaseRestoreRequest({
    projectId: project.id,
    databaseId: 'db-1',
    restoreRequestId: 'restore-request-1',
    approvalStatus: 'approved',
    approvalDetail: 'Change window approved for staging restore validation.'
  });

  assert.equal(capturedReviewInput?.['approvalStatus'], 'approved');
  assert.equal(reviewed.restoreWorkflow.status, 'approved');

  const updated = await service.updateProjectDatabaseRestoreRequest({
    projectId: project.id,
    databaseId: 'db-1',
    restoreRequestId: 'restore-request-1',
    status: 'in_progress',
    detail: 'Restore is now running on the staging validation target.'
  });

  assert.equal(capturedUpdateInput?.['status'], 'in_progress');
  assert.equal(updated.restoreWorkflow.status, 'in-progress');
});

test('createProjectDatabaseRestoreRequest rejects purged or expired backup artifacts', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findById: async () => createProjectDatabaseRecord({
        backupMode: 'external',
        backupSchedule: 'daily',
        backupRunbook: 'Nightly pg_dump plus restore runbook.'
      }),
      findBackupArtifactById: async () => createProjectDatabaseBackupArtifact({
        lifecycleStatus: 'purged',
        retentionExpiresAt: new Date('2026-03-28T12:03:00.000Z')
      })
    }
  });

  await assert.rejects(
    service.createProjectDatabaseRestoreRequest({
      projectId: project.id,
      databaseId: 'db-1',
      backupArtifactId: 'artifact-1',
      target: 'staging verification environment',
      summary: 'Verify restore before schema migration.'
    }),
    ProjectDatabaseBackupArtifactUnavailableError
  );
});

test('updateProjectDatabaseRestoreRequest rejects execution before approval', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findRestoreRequestById: async () => createProjectDatabaseRestoreRequest({
        approvalStatus: 'pending'
      })
    }
  });

  await assert.rejects(
    service.updateProjectDatabaseRestoreRequest({
      projectId: project.id,
      databaseId: 'db-1',
      restoreRequestId: 'restore-request-1',
      status: 'in_progress',
      detail: 'Restore is now running on the staging validation target.'
    }),
    ProjectDatabaseRestoreRequestApprovalNotAllowedError
  );
});

test('updateProjectDatabaseRestoreRequest rejects unknown restore requests', async () => {
  const service = createService({
    projectDatabasesRepository: {
      findRestoreRequestById: async () => null
    }
  });

  await assert.rejects(
    service.updateProjectDatabaseRestoreRequest({
      projectId: project.id,
      databaseId: 'db-1',
      restoreRequestId: 'missing-request',
      status: 'failed',
      detail: 'Restore target could not be reached.'
    }),
    ProjectDatabaseRestoreRequestNotFoundError
  );
});

test('listInjectedEnvironmentForProjectService returns generated credentials for linked ready databases', async () => {
  const service = createService({
    projectDatabasesRepository: {
      listLinkedReadyByProjectService: async () => [createProjectDatabaseRecord()]
    }
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
  const service = createService({
    managedPostgresProvisioner: {
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
