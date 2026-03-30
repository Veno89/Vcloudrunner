import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { createDefaultProjectServices } from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../../config/env.js');
const { authContextPlugin } = await import('../../plugins/auth-context.js');
const { errorHandlerPlugin } = await import('../../plugins/error-handler.js');
const { createProjectDatabasesRoutes } = await import('./project-databases.routes.js');
const { ProjectsService } = await import('../projects/projects.service.js');
const { ProjectDatabasesService } = await import('./project-databases.service.js');

const ownerUserId = '00000000-0000-0000-0000-000000000010';
const memberUserId = '00000000-0000-0000-0000-000000000020';
const outsiderUserId = '00000000-0000-0000-0000-000000000030';
const projectId = '10000000-0000-0000-0000-000000000001';

const project = {
  id: projectId,
  userId: ownerUserId,
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main',
  services: createDefaultProjectServices()
};

function createProjectDatabaseView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'db-1',
    projectId,
    engine: 'postgres',
    name: 'primary-db',
    status: 'pending_config',
    statusDetail: 'Waiting for configuration',
    databaseName: 'db_example_primary_abc123',
    username: 'user_example_primary_abc123',
    password: 'secret-pass',
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
    credentialsRotatedAt: null,
    backupMode: 'none',
    backupSchedule: null,
    backupRunbook: '',
    backupVerifiedAt: null,
    restoreVerifiedAt: null,
    backupCoverage: {
      status: 'missing',
      title: 'No backup runbook documented',
      detail: 'Managed backup automation is not configured yet.'
    },
    backupExecution: {
      status: 'not-configured',
      title: 'No backup execution coverage',
      detail: 'Document an external backup runbook before treating this database as production-ready.',
      lastRecordedAt: null,
      nextDueAt: null
    },
    restoreExercise: {
      status: 'not-configured',
      title: 'No restore exercise coverage',
      detail: 'Document an external backup runbook before tracking restore drills for this database.',
      lastRecordedAt: null
    },
    backupInventory: {
      status: 'missing',
      title: 'No backup inventory',
      detail: 'Document an external backup runbook before tracking backup artifacts for this database.',
      latestProducedAt: null,
      latestVerifiedAt: null,
      artifactCount: 0
    },
    restoreWorkflow: {
      status: 'idle',
      title: 'No restore request recorded',
      detail: 'No restore requests have been recorded yet for this database.',
      latestRequestedAt: null,
      activeRequestId: null
    },
    recentEvents: [],
    recentOperations: [],
    backupArtifacts: [],
    restoreRequests: [],
    connectionString: null,
    provisionedAt: null,
    lastProvisioningAttemptAt: '2026-03-29T12:00:00.000Z',
    lastErrorAt: null,
    createdAt: '2026-03-29T12:00:00.000Z',
    updatedAt: '2026-03-29T12:00:00.000Z',
    serviceNames: [],
    generatedEnvironment: {
      prefix: 'PRIMARY_DB',
      databaseUrlKey: 'PRIMARY_DB_DATABASE_URL',
      hostKey: 'PRIMARY_DB_DATABASE_HOST',
      portKey: 'PRIMARY_DB_DATABASE_PORT',
      databaseNameKey: 'PRIMARY_DB_DATABASE_NAME',
      usernameKey: 'PRIMARY_DB_DATABASE_USER',
      passwordKey: 'PRIMARY_DB_DATABASE_PASSWORD'
    },
    ...overrides
  };
}

function buildSelectResult(rows: unknown[]) {
  return {
    from() {
      return {
        where() {
          return {
            limit: async () => rows
          };
        }
      };
    }
  };
}

async function withProjectDatabasesRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
    scopes: string[];
    membershipRows: Array<{ role: string }>;
    onListProjectDatabases?: () => unknown;
    onCreateProjectDatabase?: (input: Record<string, unknown>) => unknown;
    onReconcileProjectDatabase?: (input: Record<string, unknown>) => unknown;
    onRotateProjectDatabaseCredentials?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectDatabaseBackupPolicy?: (input: Record<string, unknown>) => unknown;
    onRecordProjectDatabaseRecoveryCheck?: (input: Record<string, unknown>) => unknown;
    onRecordProjectDatabaseBackupArtifact?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectDatabaseBackupArtifact?: (input: Record<string, unknown>) => unknown;
    onCreateProjectDatabaseRestoreRequest?: (input: Record<string, unknown>) => unknown;
    onReviewProjectDatabaseRestoreRequest?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectDatabaseRestoreRequest?: (input: Record<string, unknown>) => unknown;
    onGetProjectDatabaseAuditExport?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectDatabaseServiceLinks?: (input: Record<string, unknown>) => unknown;
    onRemoveProjectDatabase?: (input: Record<string, unknown>) => unknown;
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;

  env.ENABLE_DEV_AUTH = false;
  env.API_TOKENS_JSON = JSON.stringify([{
    token: options.token,
    userId: options.actorUserId,
    role: 'user',
    scopes: options.scopes
  }]);

  const mockDbClient = {
    select: () => buildSelectResult(options.membershipRows)
  } as any;

  t.mock.method(ProjectsService.prototype, 'getProjectById', async () => project);
  t.mock.method(
    ProjectDatabasesService.prototype,
    'getProjectDatabaseAuditExport',
    async (input: Record<string, unknown>) => options.onGetProjectDatabaseAuditExport?.(input) ?? {
      exportedAt: '2026-03-30T09:20:00.000Z',
      database: createProjectDatabaseView({
        id: input.databaseId
      }),
      events: [],
      operations: [],
      backupArtifacts: [],
      restoreRequests: []
    }
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'listProjectDatabases',
    async () => options.onListProjectDatabases?.() ?? []
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'createProjectDatabase',
    async (input: Record<string, unknown>) => options.onCreateProjectDatabase?.(input) ?? createProjectDatabaseView({
      serviceNames: input.serviceNames ?? []
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'reconcileProjectDatabase',
    async (input: Record<string, unknown>) => options.onReconcileProjectDatabase?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      status: 'ready',
      statusDetail: 'Managed Postgres is provisioned.',
      connectionHost: 'postgres',
      connectionPort: 5432,
      connectionSslMode: 'disable',
      healthStatus: 'healthy',
      healthStatusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
      healthStatusChangedAt: '2026-03-29T12:05:00.000Z',
      lastHealthCheckAt: '2026-03-29T12:05:00.000Z',
      lastHealthyAt: '2026-03-29T12:05:00.000Z',
      connectionString: 'postgresql://user_example_primary_abc123:secret-pass@postgres:5432/db_example_primary_abc123?sslmode=disable',
      provisionedAt: '2026-03-29T12:05:00.000Z',
      lastProvisioningAttemptAt: '2026-03-29T12:05:00.000Z',
      updatedAt: '2026-03-29T12:05:00.000Z',
      serviceNames: ['app']
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'rotateProjectDatabaseCredentials',
    async (input: Record<string, unknown>) => options.onRotateProjectDatabaseCredentials?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      status: 'ready',
      statusDetail: 'Managed Postgres credentials were rotated successfully. Redeploy linked services so they receive the new generated password.',
      password: 'rotated-secret-pass',
      connectionHost: 'postgres',
      connectionPort: 5432,
      connectionSslMode: 'disable',
      healthStatus: 'healthy',
      healthStatusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
      healthStatusChangedAt: '2026-03-29T12:08:00.000Z',
      lastHealthCheckAt: '2026-03-29T12:08:00.000Z',
      lastHealthyAt: '2026-03-29T12:08:00.000Z',
      credentialsRotatedAt: '2026-03-29T12:08:00.000Z',
      connectionString: 'postgresql://user_example_primary_abc123:rotated-secret-pass@postgres:5432/db_example_primary_abc123?sslmode=disable',
      provisionedAt: '2026-03-29T12:05:00.000Z',
      lastProvisioningAttemptAt: '2026-03-29T12:08:00.000Z',
      updatedAt: '2026-03-29T12:08:00.000Z',
      serviceNames: ['app']
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'updateProjectDatabaseBackupPolicy',
    async (input: Record<string, unknown>) => options.onUpdateProjectDatabaseBackupPolicy?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      backupMode: input.backupMode,
      backupSchedule: input.backupSchedule,
      backupRunbook: input.backupRunbook,
      backupCoverage: {
        status: 'documented',
        title: 'External backup runbook documented',
        detail: 'External backup coverage is documented, but no backup or restore verification has been recorded yet.'
      }
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'recordProjectDatabaseRecoveryCheck',
    async (input: Record<string, unknown>) => options.onRecordProjectDatabaseRecoveryCheck?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      backupMode: 'external',
      backupSchedule: 'daily',
      backupRunbook: 'Nightly pg_dump with monthly restore drill.',
      backupVerifiedAt: input.kind === 'backup' ? '2026-03-29T12:09:00.000Z' : null,
      restoreVerifiedAt: input.kind === 'restore' ? '2026-03-29T12:10:00.000Z' : null,
      backupCoverage: {
        status: input.kind === 'restore' ? 'recovery-verified' : 'backup-verified',
        title: input.kind === 'restore' ? 'External backup and restore checks recorded' : 'External backup checks recorded',
        detail: 'External backup coverage is documented and verification has been recorded.'
      }
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'recordProjectDatabaseBackupArtifact',
    async (input: Record<string, unknown>) => options.onRecordProjectDatabaseBackupArtifact?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      backupInventory: {
        status: input.integrityStatus === 'verified' ? 'verified' : 'recorded',
        title: input.integrityStatus === 'verified' ? 'Verified backup artifact available' : 'Backup artifact recorded',
        detail: 'A backup artifact has been recorded for this database.',
        latestProducedAt: input.producedAt,
        latestVerifiedAt: input.integrityStatus === 'verified' ? input.producedAt : null,
        artifactCount: 1
      },
      backupArtifacts: [{
        id: 'artifact-1',
        label: input.label,
        storageProvider: input.storageProvider,
        location: input.location,
        sizeBytes: input.sizeBytes ?? null,
        producedAt: input.producedAt,
        retentionExpiresAt: input.retentionExpiresAt ?? null,
        integrityStatus: input.integrityStatus,
        lifecycleStatus: 'active',
        verifiedAt: input.integrityStatus === 'verified' ? '2026-03-30T09:00:00.000Z' : null,
        lifecycleChangedAt: '2026-03-30T09:00:00.000Z',
        detail: input.detail,
        createdAt: '2026-03-30T09:00:00.000Z',
        updatedAt: '2026-03-30T09:00:00.000Z'
      }]
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'updateProjectDatabaseBackupArtifact',
    async (input: Record<string, unknown>) => options.onUpdateProjectDatabaseBackupArtifact?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      backupInventory: {
        status: input.integrityStatus === 'verified' ? 'verified' : 'recorded',
        title: 'Backup artifact controls updated',
        detail: 'The selected backup artifact lifecycle and integrity state were updated.',
        latestProducedAt: '2026-03-30T09:00:00.000Z',
        latestVerifiedAt: input.integrityStatus === 'verified' ? '2026-03-30T09:25:00.000Z' : null,
        artifactCount: 1
      },
      backupArtifacts: [{
        id: input.backupArtifactId,
        label: 'nightly-2026-03-30',
        storageProvider: 's3',
        location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-30.dump',
        sizeBytes: 512 * 1024 * 1024,
        producedAt: '2026-03-30T09:00:00.000Z',
        retentionExpiresAt: input.retentionExpiresAt ?? null,
        integrityStatus: input.integrityStatus,
        lifecycleStatus: input.lifecycleStatus,
        verifiedAt: input.integrityStatus === 'verified' ? '2026-03-30T09:25:00.000Z' : null,
        lifecycleChangedAt: '2026-03-30T09:25:00.000Z',
        detail: input.detail ?? '',
        createdAt: '2026-03-30T09:00:00.000Z',
        updatedAt: '2026-03-30T09:25:00.000Z'
      }]
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'createProjectDatabaseRestoreRequest',
    async (input: Record<string, unknown>) => options.onCreateProjectDatabaseRestoreRequest?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      restoreWorkflow: {
        status: 'awaiting-approval',
        title: 'Restore request awaiting approval',
        detail: `A restore request is waiting for approval before execution for ${input.target}.`,
        latestRequestedAt: '2026-03-30T09:10:00.000Z',
        activeRequestId: 'restore-request-1'
      },
      restoreRequests: [{
        id: 'restore-request-1',
        backupArtifactId: input.backupArtifactId ?? null,
        backupArtifactLabel: input.backupArtifactId ? 'nightly-2026-03-30' : null,
        status: 'requested',
        approvalStatus: 'pending',
        approvalDetail: '',
        approvalReviewedAt: null,
        target: input.target,
        summary: input.summary,
        detail: input.detail ?? '',
        requestedAt: '2026-03-30T09:10:00.000Z',
        startedAt: null,
        completedAt: null,
        createdAt: '2026-03-30T09:10:00.000Z',
        updatedAt: '2026-03-30T09:10:00.000Z'
      }]
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'reviewProjectDatabaseRestoreRequest',
    async (input: Record<string, unknown>) => options.onReviewProjectDatabaseRestoreRequest?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      restoreWorkflow: {
        status: input.approvalStatus === 'approved' ? 'approved' : 'attention',
        title: input.approvalStatus === 'approved' ? 'Restore request approved' : 'Latest restore request was rejected',
        detail: input.approvalStatus === 'approved'
          ? 'A restore request is approved and ready for operator execution.'
          : 'The latest restore request was rejected and needs follow-up.',
        latestRequestedAt: '2026-03-30T09:10:00.000Z',
        activeRequestId: input.approvalStatus === 'approved' ? input.restoreRequestId : null
      },
      restoreRequests: [{
        id: input.restoreRequestId,
        backupArtifactId: 'artifact-1',
        backupArtifactLabel: 'nightly-2026-03-30',
        status: 'requested',
        approvalStatus: input.approvalStatus,
        approvalDetail: input.approvalDetail ?? '',
        approvalReviewedAt: '2026-03-30T09:12:00.000Z',
        target: 'staging verification environment',
        summary: 'Verify restore before schema migration.',
        detail: '',
        requestedAt: '2026-03-30T09:10:00.000Z',
        startedAt: null,
        completedAt: null,
        createdAt: '2026-03-30T09:10:00.000Z',
        updatedAt: '2026-03-30T09:12:00.000Z'
      }]
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'updateProjectDatabaseRestoreRequest',
    async (input: Record<string, unknown>) => options.onUpdateProjectDatabaseRestoreRequest?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      restoreWorkflow: {
        status: input.status === 'in_progress' ? 'in-progress' : input.status === 'failed' ? 'attention' : input.status === 'succeeded' ? 'succeeded' : input.status === 'cancelled' ? 'cancelled' : 'approved',
        title: 'Restore request updated',
        detail: 'The restore workflow state has been updated.',
        latestRequestedAt: '2026-03-30T09:10:00.000Z',
        activeRequestId: input.status === 'requested' || input.status === 'in_progress' ? input.restoreRequestId : null
      },
      restoreRequests: [{
        id: input.restoreRequestId,
        backupArtifactId: 'artifact-1',
        backupArtifactLabel: 'nightly-2026-03-30',
        status: input.status,
        approvalStatus: 'approved',
        approvalDetail: 'Approved for staging validation.',
        approvalReviewedAt: '2026-03-30T09:11:00.000Z',
        target: 'staging verification environment',
        summary: 'Verify restore before schema migration.',
        detail: input.detail ?? '',
        requestedAt: '2026-03-30T09:10:00.000Z',
        startedAt: input.status === 'in_progress' ? '2026-03-30T09:12:00.000Z' : null,
        completedAt: input.status === 'failed' || input.status === 'succeeded' || input.status === 'cancelled' ? '2026-03-30T09:15:00.000Z' : null,
        createdAt: '2026-03-30T09:10:00.000Z',
        updatedAt: '2026-03-30T09:15:00.000Z'
      }]
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'updateProjectDatabaseServiceLinks',
    async (input: Record<string, unknown>) => options.onUpdateProjectDatabaseServiceLinks?.(input) ?? createProjectDatabaseView({
      id: input.databaseId,
      serviceNames: input.serviceNames ?? []
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'removeProjectDatabase',
    async (input: Record<string, unknown>) => {
      options.onRemoveProjectDatabase?.(input);
    }
  );

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: mockDbClient });

  const projectsService = new ProjectsService(mockDbClient);
  const projectDatabasesService = new ProjectDatabasesService(mockDbClient);
  app.register(createProjectDatabasesRoutes(projectDatabasesService, projectsService), { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('list project databases allows project members with projects:read scope', async (t) => {
  await withProjectDatabasesRoutesApp(t, {
    token: 'member-project-databases-read-token',
    actorUserId: memberUserId,
    scopes: ['projects:read'],
    membershipRows: [{ role: 'viewer' }],
    onListProjectDatabases: () => [{ id: 'db-1', name: 'primary-db' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/databases`,
      headers: {
        authorization: 'Bearer member-project-databases-read-token'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: [{ id: 'db-1', name: 'primary-db' }] });
  });
});

test('project database audit export allows project members with projects:read scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'member-project-database-audit-token',
    actorUserId: memberUserId,
    scopes: ['projects:read'],
    membershipRows: [{ role: 'viewer' }],
    onGetProjectDatabaseAuditExport: (input) => {
      capturedInput = input;
      return {
        exportedAt: '2026-03-30T09:20:00.000Z',
        database: createProjectDatabaseView({
          id: input.databaseId
        }),
        events: [],
        operations: [],
        backupArtifacts: [],
        restoreRequests: []
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/audit/export`,
      headers: {
        authorization: 'Bearer member-project-database-audit-token'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.match(res.headers['content-disposition'] ?? '', /project-database-20000000-0000-0000-0000-000000000001-audit\.json/);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001'
    });
  });
});

test('create project database requires project membership management access', async (t) => {
  await withProjectDatabasesRoutesApp(t, {
    token: 'viewer-project-databases-write-token',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases`,
      headers: {
        authorization: 'Bearer viewer-project-databases-write-token'
      },
      payload: {
        name: 'primary-db',
        serviceNames: ['app']
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('create project database forwards payload to the service for owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-write-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onCreateProjectDatabase: (input) => {
      capturedInput = input;
      return {
        id: 'db-1',
        projectId,
        engine: 'postgres',
        name: input.name,
        status: 'pending_config',
        statusDetail: 'Waiting for configuration',
        databaseName: 'db_example_primary_abc123',
        username: 'user_example_primary_abc123',
        password: 'secret-pass',
        connectionHost: null,
        connectionPort: null,
        connectionSslMode: null,
        connectionString: null,
        provisionedAt: null,
        lastProvisioningAttemptAt: '2026-03-29T12:00:00.000Z',
        lastErrorAt: null,
        createdAt: '2026-03-29T12:00:00.000Z',
        updatedAt: '2026-03-29T12:00:00.000Z',
        serviceNames: input.serviceNames ?? [],
        generatedEnvironment: {
          prefix: 'PRIMARY_DB',
          databaseUrlKey: 'PRIMARY_DB_DATABASE_URL',
          hostKey: 'PRIMARY_DB_DATABASE_HOST',
          portKey: 'PRIMARY_DB_DATABASE_PORT',
          databaseNameKey: 'PRIMARY_DB_DATABASE_NAME',
          usernameKey: 'PRIMARY_DB_DATABASE_USER',
          passwordKey: 'PRIMARY_DB_DATABASE_PASSWORD'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases`,
      headers: {
        authorization: 'Bearer owner-project-databases-write-token'
      },
      payload: {
        name: 'primary-db',
        serviceNames: ['app']
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(capturedInput, {
      projectId,
      name: 'primary-db',
      serviceNames: ['app']
    });
  });
});

test('reconcile project database allows owners/admins to retry provisioning', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-reconcile-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onReconcileProjectDatabase: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/reconcile`,
      headers: {
        authorization: 'Bearer owner-project-databases-reconcile-token'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001'
    });
  });
});

test('rotate project database credentials allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-rotate-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRotateProjectDatabaseCredentials: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/rotate-credentials`,
      headers: {
        authorization: 'Bearer owner-project-databases-rotate-token'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001'
    });
  });
});

test('update project database backup policy allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-backup-policy-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onUpdateProjectDatabaseBackupPolicy: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/backup-policy`,
      headers: {
        authorization: 'Bearer owner-project-databases-backup-policy-token'
      },
      payload: {
        backupMode: 'external',
        backupSchedule: 'weekly',
        backupRunbook: 'Weekly snapshot plus quarterly restore drill.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      backupMode: 'external',
      backupSchedule: 'weekly',
      backupRunbook: 'Weekly snapshot plus quarterly restore drill.'
    });
  });
});

test('record project database recovery check allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-recovery-check-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRecordProjectDatabaseRecoveryCheck: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/recovery-checks`,
      headers: {
        authorization: 'Bearer owner-project-databases-recovery-check-token'
      },
      payload: {
        kind: 'restore',
        status: 'failed',
        summary: 'Restore drill could not connect to the admin host.',
        detail: 'Operator is re-running the drill after fixing network access.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      kind: 'restore',
      status: 'failed',
      summary: 'Restore drill could not connect to the admin host.',
      detail: 'Operator is re-running the drill after fixing network access.'
    });
  });
});

test('record project database backup artifact allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-backup-artifact-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRecordProjectDatabaseBackupArtifact: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/backup-artifacts`,
      headers: {
        authorization: 'Bearer owner-project-databases-backup-artifact-token'
      },
      payload: {
        label: 'nightly-2026-03-30',
        storageProvider: 's3',
        location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-30.dump',
        sizeBytes: 536870912,
        producedAt: '2026-03-30T09:00:00.000Z',
        retentionExpiresAt: '2026-04-06T09:00:00.000Z',
        integrityStatus: 'verified',
        detail: 'Checksum verified against object storage.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      label: 'nightly-2026-03-30',
      storageProvider: 's3',
      location: 's3://platform-backups/example-project/primary-db/nightly-2026-03-30.dump',
      sizeBytes: 536870912,
      producedAt: new Date('2026-03-30T09:00:00.000Z'),
      retentionExpiresAt: new Date('2026-04-06T09:00:00.000Z'),
      integrityStatus: 'verified',
      detail: 'Checksum verified against object storage.'
    });
  });
});

test('update project database backup artifact allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-backup-artifact-update-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onUpdateProjectDatabaseBackupArtifact: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/backup-artifacts/30000000-0000-0000-0000-000000000001`,
      headers: {
        authorization: 'Bearer owner-project-databases-backup-artifact-update-token'
      },
      payload: {
        integrityStatus: 'verified',
        lifecycleStatus: 'archived',
        retentionExpiresAt: '2026-04-10T09:00:00.000Z',
        detail: 'Retained only for rollback validation.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      backupArtifactId: '30000000-0000-0000-0000-000000000001',
      integrityStatus: 'verified',
      lifecycleStatus: 'archived',
      retentionExpiresAt: new Date('2026-04-10T09:00:00.000Z'),
      detail: 'Retained only for rollback validation.'
    });
  });
});

test('create project database restore request allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-restore-request-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onCreateProjectDatabaseRestoreRequest: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/restore-requests`,
      headers: {
        authorization: 'Bearer owner-project-databases-restore-request-token'
      },
      payload: {
        backupArtifactId: '30000000-0000-0000-0000-000000000001',
        target: 'staging verification environment',
        summary: 'Verify restore before schema migration.',
        detail: 'Operator is preparing a disposable validation target.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      backupArtifactId: '30000000-0000-0000-0000-000000000001',
      target: 'staging verification environment',
      summary: 'Verify restore before schema migration.',
      detail: 'Operator is preparing a disposable validation target.'
    });
  });
});

test('review project database restore request allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-restore-review-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onReviewProjectDatabaseRestoreRequest: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/restore-requests/40000000-0000-0000-0000-000000000001/approval`,
      headers: {
        authorization: 'Bearer owner-project-databases-restore-review-token'
      },
      payload: {
        approvalStatus: 'approved',
        approvalDetail: 'Approved for staging restore validation.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      restoreRequestId: '40000000-0000-0000-0000-000000000001',
      approvalStatus: 'approved',
      approvalDetail: 'Approved for staging restore validation.'
    });
  });
});

test('update project database restore request allows owners/admins', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectDatabasesRoutesApp(t, {
    token: 'owner-project-databases-restore-update-token',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onUpdateProjectDatabaseRestoreRequest: (input) => {
      capturedInput = input;
      return undefined;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001/restore-requests/40000000-0000-0000-0000-000000000001`,
      headers: {
        authorization: 'Bearer owner-project-databases-restore-update-token'
      },
      payload: {
        status: 'in_progress',
        detail: 'Restore is now running on the staging validation target.'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      databaseId: '20000000-0000-0000-0000-000000000001',
      restoreRequestId: '40000000-0000-0000-0000-000000000001',
      status: 'in_progress',
      detail: 'Restore is now running on the staging validation target.'
    });
  });
});

test('delete project database rejects non-members who are not the owner or admin', async (t) => {
  await withProjectDatabasesRoutesApp(t, {
    token: 'outsider-project-databases-delete-token',
    actorUserId: outsiderUserId,
    scopes: ['projects:write'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/databases/20000000-0000-0000-0000-000000000001`,
      headers: {
        authorization: 'Bearer outsider-project-databases-delete-token'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});
