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
    'listProjectDatabases',
    async () => options.onListProjectDatabases?.() ?? []
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'createProjectDatabase',
    async (input: Record<string, unknown>) => options.onCreateProjectDatabase?.(input) ?? ({
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
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'reconcileProjectDatabase',
    async (input: Record<string, unknown>) => options.onReconcileProjectDatabase?.(input) ?? ({
      id: input.databaseId,
      projectId,
      engine: 'postgres',
      name: 'primary-db',
      status: 'ready',
      statusDetail: 'Managed Postgres is provisioned.',
      databaseName: 'db_example_primary_abc123',
      username: 'user_example_primary_abc123',
      password: 'secret-pass',
      connectionHost: 'postgres',
      connectionPort: 5432,
      connectionSslMode: 'disable',
      healthStatus: 'healthy',
      healthStatusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
      healthStatusChangedAt: '2026-03-29T12:05:00.000Z',
      lastHealthCheckAt: '2026-03-29T12:05:00.000Z',
      lastHealthyAt: '2026-03-29T12:05:00.000Z',
      lastHealthErrorAt: null,
      consecutiveHealthCheckFailures: 0,
      credentialsRotatedAt: null,
      connectionString: 'postgresql://user_example_primary_abc123:secret-pass@postgres:5432/db_example_primary_abc123?sslmode=disable',
      provisionedAt: '2026-03-29T12:05:00.000Z',
      lastProvisioningAttemptAt: '2026-03-29T12:05:00.000Z',
      lastErrorAt: null,
      createdAt: '2026-03-29T12:00:00.000Z',
      updatedAt: '2026-03-29T12:05:00.000Z',
      serviceNames: ['app'],
      generatedEnvironment: {
        prefix: 'PRIMARY_DB',
        databaseUrlKey: 'PRIMARY_DB_DATABASE_URL',
        hostKey: 'PRIMARY_DB_DATABASE_HOST',
        portKey: 'PRIMARY_DB_DATABASE_PORT',
        databaseNameKey: 'PRIMARY_DB_DATABASE_NAME',
        usernameKey: 'PRIMARY_DB_DATABASE_USER',
        passwordKey: 'PRIMARY_DB_DATABASE_PASSWORD'
      }
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'rotateProjectDatabaseCredentials',
    async (input: Record<string, unknown>) => options.onRotateProjectDatabaseCredentials?.(input) ?? ({
      id: input.databaseId,
      projectId,
      engine: 'postgres',
      name: 'primary-db',
      status: 'ready',
      statusDetail: 'Managed Postgres credentials were rotated successfully. Redeploy linked services so they receive the new generated password.',
      databaseName: 'db_example_primary_abc123',
      username: 'user_example_primary_abc123',
      password: 'rotated-secret-pass',
      connectionHost: 'postgres',
      connectionPort: 5432,
      connectionSslMode: 'disable',
      healthStatus: 'healthy',
      healthStatusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
      healthStatusChangedAt: '2026-03-29T12:08:00.000Z',
      lastHealthCheckAt: '2026-03-29T12:08:00.000Z',
      lastHealthyAt: '2026-03-29T12:08:00.000Z',
      lastHealthErrorAt: null,
      consecutiveHealthCheckFailures: 0,
      credentialsRotatedAt: '2026-03-29T12:08:00.000Z',
      connectionString: 'postgresql://user_example_primary_abc123:rotated-secret-pass@postgres:5432/db_example_primary_abc123?sslmode=disable',
      provisionedAt: '2026-03-29T12:05:00.000Z',
      lastProvisioningAttemptAt: '2026-03-29T12:08:00.000Z',
      lastErrorAt: null,
      createdAt: '2026-03-29T12:00:00.000Z',
      updatedAt: '2026-03-29T12:08:00.000Z',
      serviceNames: ['app'],
      generatedEnvironment: {
        prefix: 'PRIMARY_DB',
        databaseUrlKey: 'PRIMARY_DB_DATABASE_URL',
        hostKey: 'PRIMARY_DB_DATABASE_HOST',
        portKey: 'PRIMARY_DB_DATABASE_PORT',
        databaseNameKey: 'PRIMARY_DB_DATABASE_NAME',
        usernameKey: 'PRIMARY_DB_DATABASE_USER',
        passwordKey: 'PRIMARY_DB_DATABASE_PASSWORD'
      }
    })
  );
  t.mock.method(
    ProjectDatabasesService.prototype,
    'updateProjectDatabaseServiceLinks',
    async (input: Record<string, unknown>) => options.onUpdateProjectDatabaseServiceLinks?.(input) ?? ({
      id: input.databaseId,
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
