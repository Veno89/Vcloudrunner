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
const { createProjectsRoutes } = await import('./projects.routes.js');
const { ProjectsService } = await import('./projects.service.js');

const ownerUserId = '00000000-0000-0000-0000-000000000010';
const memberUserId = '00000000-0000-0000-0000-000000000020';
const outsiderUserId = '00000000-0000-0000-0000-000000000030';
const adminUserId = '00000000-0000-0000-0000-000000000040';
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

async function withProjectsRoutesApp(
  t: TestContext,
  options: {
    token: string;
    actorUserId: string;
    role?: 'admin' | 'user';
    scopes?: string[];
    membershipRows: Array<{ role: string }>;
    accessibleProjects?: typeof project[];
    onCreateProjectInput?: (input: Record<string, unknown>) => void;
  },
  run: (app: FastifyInstance) => Promise<void>
) {
  const originalEnableDevAuth = env.ENABLE_DEV_AUTH;
  const originalApiTokensJson = env.API_TOKENS_JSON;

  env.ENABLE_DEV_AUTH = false;
  env.API_TOKENS_JSON = JSON.stringify([{
    token: options.token,
    userId: options.actorUserId,
    role: options.role ?? 'user',
    scopes: options.scopes ?? ['projects:read']
  }]);

  const mockDbClient = {
    select: () => buildSelectResult([]),
    selectDistinct: () => buildSelectResult([])
  } as any;

  t.mock.method(ProjectsService.prototype, 'createProject', async (input: Record<string, unknown>) => {
    options.onCreateProjectInput?.(input as Record<string, unknown>);
    return {
      ...project,
      ...(input && typeof input === 'object' && 'services' in input ? { services: (input as { services?: typeof project.services }).services ?? project.services } : {})
    };
  });
  t.mock.method(ProjectsService.prototype, 'getProjectById', async () => project);
  t.mock.method(mockDbClient, 'select', (fields: Record<string, unknown>) => {
    if (Object.prototype.hasOwnProperty.call(fields, 'userId')) {
      return buildSelectResult([]);
    }

    return buildSelectResult(options.membershipRows);
  });
  t.mock.method(mockDbClient, 'selectDistinct', () => ({
    from() {
      return {
        leftJoin() {
          return {
            where() {
              return {
                orderBy: async () => options.accessibleProjects ?? []
              };
            }
          };
        }
      };
    }
  }));

  const app = Fastify({ logger: false });
  t.after(async () => {
    env.ENABLE_DEV_AUTH = originalEnableDevAuth;
    env.API_TOKENS_JSON = originalApiTokensJson;
    await app.close();
  });

  app.register(errorHandlerPlugin);
  app.register(authContextPlugin, { dbClient: mockDbClient });
  
  const projectsService = new ProjectsService(mockDbClient);
  app.register(createProjectsRoutes(projectsService), { prefix: '/v1' });

  await app.ready();
  await run(app);
}

test('create project allows admin access to another user without explicit token scopes', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'admin-create-project-token-123',
    actorUserId: adminUserId,
    role: 'admin',
    scopes: [],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: 'Bearer admin-create-project-token-123'
      },
      payload: {
        userId: ownerUserId,
        name: project.name,
        slug: project.slug,
        gitRepositoryUrl: project.gitRepositoryUrl,
        defaultBranch: project.defaultBranch
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(JSON.parse(res.body), { data: project });
  });
});

test('create project rejects tokens missing projects:write scope', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-create-project-no-write-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: 'Bearer member-create-project-no-write-token-123'
      },
      payload: {
        userId: ownerUserId,
        name: project.name,
        slug: project.slug,
        gitRepositoryUrl: project.gitRepositoryUrl,
        defaultBranch: project.defaultBranch
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('create project rejects non-admin access to another user resource', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-create-project-cross-user-token-123',
    actorUserId: outsiderUserId,
    scopes: ['projects:write'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: 'Bearer member-create-project-cross-user-token-123'
      },
      payload: {
        userId: ownerUserId,
        name: project.name,
        slug: project.slug,
        gitRepositoryUrl: project.gitRepositoryUrl,
        defaultBranch: project.defaultBranch
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_USER_ACCESS');
  });
});

test('create project accepts a valid multi-service composition', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'owner-create-project-services-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onCreateProjectInput: (input) => {
      capturedInput = input;
    }
  }, async (app) => {
    const services = [
      {
        name: 'frontend',
        kind: 'web',
        sourceRoot: 'apps/frontend',
        exposure: 'public',
        runtime: {
          containerPort: 3000
        }
      },
      {
        name: 'api',
        kind: 'web',
        sourceRoot: 'apps/api',
        exposure: 'internal',
        runtime: {
          containerPort: 4000
        }
      }
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: 'Bearer owner-create-project-services-token-123'
      },
      payload: {
        userId: ownerUserId,
        name: project.name,
        slug: project.slug,
        gitRepositoryUrl: project.gitRepositoryUrl,
        defaultBranch: project.defaultBranch,
        services
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(capturedInput?.services, services);
    assert.deepEqual(JSON.parse(res.body), {
      data: {
        ...project,
        services
      }
    });
  });
});

test('create project rejects service compositions without exactly one public service', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'owner-create-project-invalid-services-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        authorization: 'Bearer owner-create-project-invalid-services-token-123'
      },
      payload: {
        userId: ownerUserId,
        name: project.name,
        slug: project.slug,
        gitRepositoryUrl: project.gitRepositoryUrl,
        services: [
          {
            name: 'frontend',
            kind: 'web',
            sourceRoot: 'apps/frontend',
            exposure: 'public'
          },
          {
            name: 'marketing',
            kind: 'web',
            sourceRoot: 'apps/marketing',
            exposure: 'public'
          }
        ]
      }
    });

    assert.equal(res.statusCode, 400);
  });
});

test('list projects allows admin access to another user without explicit token scopes', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'admin-list-projects-token-123',
    actorUserId: adminUserId,
    role: 'admin',
    scopes: [],
    membershipRows: [],
    accessibleProjects: [project]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${ownerUserId}/projects`,
      headers: {
        authorization: 'Bearer admin-list-projects-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: [project] });
  });
});

test('list projects rejects tokens missing projects:read scope', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-list-no-read-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    accessibleProjects: [project]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${ownerUserId}/projects`,
      headers: {
        authorization: 'Bearer member-list-no-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('get project by id allows project members with projects:read scope', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-token-123',
    actorUserId: memberUserId,
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: 'Bearer member-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: project });
  });
});

test('get project by id rejects tokens missing projects:read scope', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-project-no-read-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: 'Bearer member-project-no-read-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_TOKEN_SCOPE');
  });
});

test('list projects includes membership-accessible projects for the actor user', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-list-token-123',
    actorUserId: memberUserId,
    membershipRows: [],
    accessibleProjects: [project]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${memberUserId}/projects`,
      headers: {
        authorization: 'Bearer member-list-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: [project] });
  });
});

test('list projects rejects non-admin access to another user resource', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'outsider-list-projects-token-123',
    actorUserId: outsiderUserId,
    scopes: ['projects:read'],
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${ownerUserId}/projects`,
      headers: {
        authorization: 'Bearer outsider-list-projects-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_USER_ACCESS');
  });
});

test('get project by id rejects non-members who are not the owner or admin', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'outsider-token-123',
    actorUserId: outsiderUserId,
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: {
        authorization: 'Bearer outsider-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});
