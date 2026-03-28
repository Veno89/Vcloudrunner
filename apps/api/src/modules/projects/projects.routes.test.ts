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
    listProjectDomainsResult?: Array<Record<string, unknown>>;
    onListProjectDomains?: (
      projectId: string,
      options?: {
        includeDiagnostics?: boolean;
      }
    ) => unknown;
    listProjectMembersResult?: Array<Record<string, unknown>>;
    listProjectInvitationsResult?: Array<Record<string, unknown>>;
    onCreateProjectDomain?: (input: Record<string, unknown>) => unknown;
    onRemoveProjectDomain?: (input: Record<string, unknown>) => unknown;
    onVerifyProjectDomainClaim?: (input: Record<string, unknown>) => unknown;
    onGetProjectInvitationClaim?: (claimToken: string) => unknown;
    onAcceptProjectInvitationClaim?: (input: Record<string, unknown>) => unknown;
    onInviteProjectMember?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectInvitation?: (input: Record<string, unknown>) => unknown;
    onRemoveProjectInvitation?: (input: Record<string, unknown>) => unknown;
    onRedeliverProjectInvitation?: (input: Record<string, unknown>) => unknown;
    onUpdateProjectMember?: (input: Record<string, unknown>) => unknown;
    onRemoveProjectMember?: (input: Record<string, unknown>) => unknown;
    onTransferProjectOwnership?: (input: Record<string, unknown>) => unknown;
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
  t.mock.method(
    ProjectsService.prototype,
    'listProjectDomains',
    async (
      requestedProjectId: string,
      listOptions?: {
        includeDiagnostics?: boolean;
      }
    ) => {
      const result = options.onListProjectDomains?.(requestedProjectId, listOptions);
      return result ?? options.listProjectDomainsResult ?? [];
    }
  );
  t.mock.method(ProjectsService.prototype, 'createProjectDomain', async (input: Record<string, unknown>) => {
    const result = options.onCreateProjectDomain?.(input);
    return result ?? {
      id: 'domain-1',
      projectId,
      deploymentId: null,
      host: input.host,
      targetPort: 3000,
      createdAt: '2026-03-27T10:00:00.000Z',
      updatedAt: '2026-03-27T10:00:00.000Z',
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public',
      routeStatus: 'pending',
      statusDetail: 'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
    };
  });
  t.mock.method(ProjectsService.prototype, 'removeProjectDomain', async (input: Record<string, unknown>) => {
    options.onRemoveProjectDomain?.(input);
  });
  t.mock.method(ProjectsService.prototype, 'verifyProjectDomainClaim', async (input: Record<string, unknown>) => {
    const result = options.onVerifyProjectDomainClaim?.(input);
    return result ?? {
      id: 'domain-1',
      projectId,
      deploymentId: null,
      host: 'api.example.com',
      targetPort: 3000,
      verificationStatus: 'pending',
      verificationDetail: 'Publish the TXT ownership challenge and retry verification.',
      verificationCheckedAt: '2026-03-28T12:00:00.000Z',
      verificationStatusChangedAt: '2026-03-28T12:00:00.000Z',
      verificationVerifiedAt: null,
      ownershipStatus: 'pending',
      ownershipDetail: 'Routing DNS has not been verified yet.',
      tlsStatus: 'pending',
      tlsDetail: 'TLS will be checked after routing is active.',
      diagnosticsCheckedAt: '2026-03-28T12:00:00.000Z',
      diagnosticsFreshnessStatus: 'fresh',
      diagnosticsFreshnessDetail: 'Stored verification, DNS, and TLS checks are within the current freshness window.',
      claimState: 'publish-verification-record',
      claimTitle: 'Publish verification TXT',
      claimDetail: 'Create the TXT ownership challenge record and verify again.',
      claimDnsRecordType: 'TXT',
      claimDnsRecordName: '_vcloudrunner.api.example.com',
      claimDnsRecordValue: 'vcloudrunner-verify=challenge-token',
      verificationDnsRecordType: 'TXT',
      verificationDnsRecordName: '_vcloudrunner.api.example.com',
      verificationDnsRecordValue: 'vcloudrunner-verify=challenge-token',
      routingDnsRecordType: 'CNAME',
      routingDnsRecordName: 'api.example.com',
      routingDnsRecordValue: 'example-project.platform.local',
      recentEvents: [],
      ownershipStatusChangedAt: null,
      tlsStatusChangedAt: null,
      ownershipVerifiedAt: null,
      tlsReadyAt: null,
      createdAt: '2026-03-27T10:00:00.000Z',
      updatedAt: '2026-03-28T12:00:00.000Z',
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public',
      routeStatus: 'pending',
      statusDetail: 'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
    };
  });
  t.mock.method(ProjectsService.prototype, 'listProjectMembers', async () => options.listProjectMembersResult ?? []);
  t.mock.method(ProjectsService.prototype, 'listProjectInvitations', async () => options.listProjectInvitationsResult ?? []);
  t.mock.method(ProjectsService.prototype, 'getProjectInvitationClaim', async (claimToken: string) => {
    const result = options.onGetProjectInvitationClaim?.(claimToken);
    return result ?? {
      id: 'invite-claim-1',
      projectId,
      projectName: project.name,
      projectSlug: project.slug,
      email: 'pending@example.com',
      claimToken,
      role: 'viewer',
      status: 'pending',
      invitedBy: ownerUserId,
      acceptedBy: null,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
      acceptedAt: null,
      cancelledAt: null,
      invitedByUser: {
        id: ownerUserId,
        name: 'Owner User',
        email: 'owner@example.com'
      },
      acceptedByUser: null
    };
  });
  t.mock.method(ProjectsService.prototype, 'acceptProjectInvitationClaim', async (input: Record<string, unknown>) => {
    const result = options.onAcceptProjectInvitationClaim?.(input);
    return result ?? {
      id: 'invite-claim-1',
      projectId,
      projectName: project.name,
      projectSlug: project.slug,
      email: 'pending@example.com',
      claimToken: input.claimToken,
      role: 'viewer',
      status: 'accepted',
      invitedBy: ownerUserId,
      acceptedBy: options.actorUserId,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T01:00:00.000Z',
      acceptedAt: '2026-03-26T01:00:00.000Z',
      cancelledAt: null,
      invitedByUser: {
        id: ownerUserId,
        name: 'Owner User',
        email: 'owner@example.com'
      },
      acceptedByUser: {
        id: options.actorUserId,
        name: 'Accepted User',
        email: 'pending@example.com'
      }
    };
  });
  t.mock.method(ProjectsService.prototype, 'inviteProjectMember', async (input: Record<string, unknown>) => {
    const result = options.onInviteProjectMember?.(input);
    return result ?? {
      kind: 'member',
      member: {
        id: 'member-1',
        projectId,
        userId: memberUserId,
        role: 'viewer',
        invitedBy: ownerUserId,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T00:00:00.000Z',
        isOwner: false,
        user: {
          id: memberUserId,
          name: 'Member User',
          email: 'member@example.com'
        }
      }
    };
  });
  t.mock.method(ProjectsService.prototype, 'updateProjectInvitation', async (input: Record<string, unknown>) => {
    const result = options.onUpdateProjectInvitation?.(input);
    return result ?? {
      id: 'invite-1',
      projectId,
      email: 'pending@example.com',
      claimToken: 'claim-token-123',
      role: 'editor',
      status: 'pending',
      invitedBy: ownerUserId,
      acceptedBy: null,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T01:00:00.000Z',
      acceptedAt: null,
      cancelledAt: null,
      invitedByUser: {
        id: ownerUserId,
        name: 'Owner User',
        email: 'owner@example.com'
      },
      acceptedByUser: null
    };
  });
  t.mock.method(ProjectsService.prototype, 'removeProjectInvitation', async (input: Record<string, unknown>) => {
    options.onRemoveProjectInvitation?.(input);
  });
  t.mock.method(ProjectsService.prototype, 'redeliverProjectInvitation', async (input: Record<string, unknown>) => {
    const result = options.onRedeliverProjectInvitation?.(input);
    return result ?? {
      invitation: {
        id: 'invite-1',
        projectId,
        email: 'pending@example.com',
        claimToken: 'claim-token-123',
        role: 'viewer',
        status: 'pending',
        invitedBy: ownerUserId,
        acceptedBy: null,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T01:00:00.000Z',
        acceptedAt: null,
        cancelledAt: null,
        invitedByUser: {
          id: ownerUserId,
          name: 'Owner User',
          email: 'owner@example.com'
        },
        acceptedByUser: null
      },
      delivery: {
        status: 'delivered',
        message: 'Invitation delivery request completed successfully.',
        claimUrl: 'https://platform.example.com/invitations/claim-token-123',
        attemptedAt: '2026-03-26T01:00:00.000Z'
      }
    };
  });
  t.mock.method(ProjectsService.prototype, 'updateProjectMemberRole', async (input: Record<string, unknown>) => {
    const result = options.onUpdateProjectMember?.(input);
    return result ?? {
      id: 'member-1',
      projectId,
      userId: memberUserId,
      role: 'admin',
      invitedBy: ownerUserId,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
      isOwner: false,
      user: {
        id: memberUserId,
        name: 'Member User',
        email: 'member@example.com'
      }
    };
  });
  t.mock.method(ProjectsService.prototype, 'removeProjectMember', async (input: Record<string, unknown>) => {
    options.onRemoveProjectMember?.(input);
  });
  t.mock.method(ProjectsService.prototype, 'transferProjectOwnership', async (input: Record<string, unknown>) => {
    const result = options.onTransferProjectOwnership?.(input);
    return result ?? {
      id: 'member-2',
      projectId,
      userId: memberUserId,
      role: 'admin',
      invitedBy: ownerUserId,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T01:00:00.000Z',
      isOwner: true,
      user: {
        id: memberUserId,
        name: 'New Owner',
        email: 'member@example.com'
      }
    };
  });
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

test('list project domains returns the persisted route status payload', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'member-project-domains-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:read'],
    membershipRows: [],
    listProjectDomainsResult: [{
      id: 'domain-1',
      projectId,
      deploymentId: 'deployment-1',
      host: 'example-project.apps.platform.example.com',
      targetPort: 3100,
      createdAt: '2026-03-27T10:00:00.000Z',
      updatedAt: '2026-03-27T10:05:00.000Z',
      deploymentStatus: 'running',
      runtimeUrl: 'http://example-project.apps.platform.example.com',
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public',
      routeStatus: 'active',
      statusDetail: 'Route is active and serving traffic from the current running deployment.'
    }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/domains`,
      headers: {
        authorization: 'Bearer member-project-domains-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      data: [{
        id: 'domain-1',
        projectId,
        deploymentId: 'deployment-1',
        host: 'example-project.apps.platform.example.com',
        targetPort: 3100,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:05:00.000Z',
        deploymentStatus: 'running',
        runtimeUrl: 'http://example-project.apps.platform.example.com',
        serviceName: 'app',
        serviceKind: 'web',
        serviceExposure: 'public',
        routeStatus: 'active',
        statusDetail: 'Route is active and serving traffic from the current running deployment.'
      }]
    });
  });
});

test('list project domains only includes DNS and TLS diagnostics when requested', async (t) => {
  let capturedProjectId: string | null = null;
  let capturedOptions: { includeDiagnostics?: boolean } | undefined;

  await withProjectsRoutesApp(t, {
    token: 'member-project-domains-diagnostics-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:read'],
    membershipRows: [],
    onListProjectDomains: (requestedProjectId, options) => {
      capturedProjectId = requestedProjectId;
      capturedOptions = options;
      return [{
        id: 'domain-1',
        projectId,
        deploymentId: 'deployment-1',
        host: 'example-project.apps.platform.example.com',
        targetPort: 3100,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-27T10:05:00.000Z',
        deploymentStatus: 'running',
        runtimeUrl: 'http://example-project.apps.platform.example.com',
        serviceName: 'app',
        serviceKind: 'web',
        serviceExposure: 'public',
        routeStatus: 'active',
        statusDetail: 'Route is active and serving traffic from the current running deployment.',
        ownershipStatus: 'managed',
        ownershipDetail: 'This is the platform-managed default host for the project.',
        tlsStatus: 'ready',
        tlsDetail: 'HTTPS is reachable and the current certificate validated successfully.'
      }];
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/domains?includeDiagnostics=true`,
      headers: {
        authorization: 'Bearer member-project-domains-diagnostics-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(capturedProjectId, projectId);
    assert.deepEqual(capturedOptions, {
      includeDiagnostics: true
    });
    assert.equal(JSON.parse(res.body).data[0]?.tlsStatus, 'ready');
  });
});

test('create project domain stores a pending custom domain claim', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'member-project-domain-create-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'admin' }],
    onCreateProjectDomain: (input) => {
      capturedInput = input;
      return {
        id: 'domain-create-1',
        projectId,
        deploymentId: null,
        host: input.host,
        targetPort: 3000,
        createdAt: '2026-03-27T11:00:00.000Z',
        updatedAt: '2026-03-27T11:00:00.000Z',
        deploymentStatus: null,
        runtimeUrl: null,
        serviceName: 'app',
        serviceKind: 'web',
        serviceExposure: 'public',
        routeStatus: 'pending',
        statusDetail: 'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/domains`,
      headers: {
        authorization: 'Bearer member-project-domain-create-token-123'
      },
      payload: {
        host: 'api.example.com'
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(capturedInput, {
      projectId,
      host: 'api.example.com'
    });
    assert.equal(JSON.parse(res.body).data.routeStatus, 'pending');
  });
});

test('remove project domain deletes a custom domain claim', async (t) => {
  const removedInputs: Array<Record<string, unknown>> = [];

  await withProjectsRoutesApp(t, {
    token: 'member-project-domain-remove-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'admin' }],
    onRemoveProjectDomain: (input) => {
      removedInputs.push(input);
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/domains/10000000-0000-0000-0000-000000000099`,
      headers: {
        authorization: 'Bearer member-project-domain-remove-token-123'
      }
    });

    assert.equal(res.statusCode, 204);
    assert.deepEqual(removedInputs, [{
      projectId,
      domainId: '10000000-0000-0000-0000-000000000099'
    }]);
  });
});

test('verify project domain claim refreshes the targeted custom domain', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'member-project-domain-verify-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'admin' }],
    onVerifyProjectDomainClaim: (input) => {
      capturedInput = input;
      return {
        id: 'domain-verify-1',
        projectId,
        deploymentId: null,
        host: 'api.example.com',
        targetPort: 3000,
        verificationStatus: 'verified',
        verificationDetail: 'Ownership challenge verified through TXT record _vcloudrunner.api.example.com.',
        verificationCheckedAt: '2026-03-28T12:00:00.000Z',
        verificationStatusChangedAt: '2026-03-28T12:00:00.000Z',
        verificationVerifiedAt: '2026-03-28T12:00:00.000Z',
        ownershipStatus: 'pending',
        ownershipDetail: 'No routing DNS records were found yet.',
        tlsStatus: 'pending',
        tlsDetail: 'TLS will be checked after this host is attached to a running deployment route.',
        diagnosticsCheckedAt: '2026-03-28T12:00:00.000Z',
        diagnosticsFreshnessStatus: 'fresh',
        diagnosticsFreshnessDetail: 'Stored verification, DNS, and TLS checks are within the current freshness window.',
        claimState: 'configure-dns',
        claimTitle: 'Configure DNS',
        claimDetail: 'Create a CNAME from api.example.com to example-project.platform.local.',
        claimDnsRecordType: 'CNAME',
        claimDnsRecordName: 'api.example.com',
        claimDnsRecordValue: 'example-project.platform.local',
        verificationDnsRecordType: 'TXT',
        verificationDnsRecordName: '_vcloudrunner.api.example.com',
        verificationDnsRecordValue: 'vcloudrunner-verify=challenge-token',
        routingDnsRecordType: 'CNAME',
        routingDnsRecordName: 'api.example.com',
        routingDnsRecordValue: 'example-project.platform.local',
        recentEvents: [],
        ownershipStatusChangedAt: null,
        tlsStatusChangedAt: null,
        ownershipVerifiedAt: null,
        tlsReadyAt: null,
        createdAt: '2026-03-27T10:00:00.000Z',
        updatedAt: '2026-03-28T12:00:00.000Z',
        deploymentStatus: null,
        runtimeUrl: null,
        serviceName: 'app',
        serviceKind: 'web',
        serviceExposure: 'public',
        routeStatus: 'pending',
        statusDetail: 'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/domains/10000000-0000-0000-0000-000000000099/verify`,
      headers: {
        authorization: 'Bearer member-project-domain-verify-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      domainId: '10000000-0000-0000-0000-000000000099'
    });
    assert.equal(JSON.parse(res.body).data.verificationStatus, 'verified');
    assert.equal(JSON.parse(res.body).data.claimState, 'configure-dns');
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

test('list project members allows project members with projects:read scope', async (t) => {
  const members = [{
    id: ownerUserId,
    projectId,
    userId: ownerUserId,
    role: 'admin',
    invitedBy: null,
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
    isOwner: true,
    user: {
      id: ownerUserId,
      name: 'Owner User',
      email: 'owner@example.com'
    }
  }];

  await withProjectsRoutesApp(t, {
    token: 'member-list-members-token-123',
    actorUserId: memberUserId,
    membershipRows: [{ role: 'viewer' }],
    listProjectMembersResult: members
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/members`,
      headers: {
        authorization: 'Bearer member-list-members-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: members });
  });
});

test('list project members rejects non-members who are not the owner or admin', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'outsider-list-members-token-123',
    actorUserId: outsiderUserId,
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/members`,
      headers: {
        authorization: 'Bearer outsider-list-members-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_ACCESS');
  });
});

test('list project invitations allows owner/project-admin access with projects:read scope', async (t) => {
  const invitations = [{
    id: 'invite-1',
    projectId,
    email: 'pending@example.com',
    role: 'viewer',
    invitedBy: ownerUserId,
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
    invitedByUser: {
      id: ownerUserId,
      name: 'Owner User',
      email: 'owner@example.com'
    }
  }];

  await withProjectsRoutesApp(t, {
    token: 'owner-list-invitations-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:read'],
    membershipRows: [],
    listProjectInvitationsResult: invitations
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/invitations`,
      headers: {
        authorization: 'Bearer owner-list-invitations-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { data: invitations });
  });
});

test('list project invitations rejects project viewers without membership-management access', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'viewer-list-invitations-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:read'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/invitations`,
      headers: {
        authorization: 'Bearer viewer-list-invitations-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('get project invitation claim allows unauthenticated claim lookups by token', async (t) => {
  const claimToken = 'claim-token-123';

  await withProjectsRoutesApp(t, {
    token: 'unused-claim-token-lookup-123',
    actorUserId: ownerUserId,
    membershipRows: [],
    onGetProjectInvitationClaim: (inputClaimToken) => ({
      id: 'invite-claim-1',
      projectId,
      projectName: project.name,
      projectSlug: project.slug,
      email: 'pending@example.com',
      claimToken: inputClaimToken,
      role: 'viewer',
      status: 'pending',
      invitedBy: ownerUserId,
      acceptedBy: null,
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
      acceptedAt: null,
      cancelledAt: null,
      invitedByUser: {
        id: ownerUserId,
        name: 'Owner User',
        email: 'owner@example.com'
      },
      acceptedByUser: null
    })
  }, async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/project-invitations/claim/${claimToken}`
    });

    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).data.claimToken, claimToken);
  });
});

test('accept project invitation claim allows authenticated users without project scopes', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const claimToken = 'claim-token-123';

  await withProjectsRoutesApp(t, {
    token: 'accept-invitation-token-123',
    actorUserId: memberUserId,
    scopes: [],
    membershipRows: [],
    onAcceptProjectInvitationClaim: (input) => {
      capturedInput = input;
      return {
        id: 'invite-claim-1',
        projectId,
        projectName: project.name,
        projectSlug: project.slug,
        email: 'pending@example.com',
        claimToken,
        role: 'viewer',
        status: 'accepted',
        invitedBy: ownerUserId,
        acceptedBy: memberUserId,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T01:00:00.000Z',
        acceptedAt: '2026-03-26T01:00:00.000Z',
        cancelledAt: null,
        invitedByUser: {
          id: ownerUserId,
          name: 'Owner User',
          email: 'owner@example.com'
        },
        acceptedByUser: {
          id: memberUserId,
          name: 'Member User',
          email: 'pending@example.com'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/project-invitations/claim/${claimToken}/accept`,
      headers: {
        authorization: 'Bearer accept-invitation-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      claimToken,
      actorUserId: memberUserId
    });
  });
});

test('accept project invitation claim rejects requests without an authenticated actor', async (t) => {
  const claimToken = 'claim-token-123';

  await withProjectsRoutesApp(t, {
    token: 'unused-claim-accept-123',
    actorUserId: ownerUserId,
    membershipRows: []
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/project-invitations/claim/${claimToken}/accept`
    });

    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
  });
});

test('invite project member allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'owner-invite-member-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onInviteProjectMember: (input) => {
      capturedInput = input;
      return {
        kind: 'invitation',
        invitation: {
          id: 'invite-2',
          projectId,
          email: 'member@example.com',
          role: 'editor',
          invitedBy: ownerUserId,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
          invitedByUser: null
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/members`,
      headers: {
        authorization: 'Bearer owner-invite-member-token-123'
      },
      payload: {
        email: 'member@example.com',
        role: 'editor'
      }
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(capturedInput, {
      projectId,
      email: 'member@example.com',
      role: 'editor',
      invitedBy: ownerUserId
    });
  });
});

test('invite project member rejects project viewers without membership-management access', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'viewer-invite-member-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/members`,
      headers: {
        authorization: 'Bearer viewer-invite-member-token-123'
      },
      payload: {
        email: 'member@example.com',
        role: 'viewer'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('update project invitation allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'owner-update-invitation-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onUpdateProjectInvitation: (input) => {
      capturedInput = input;
      return {
        id: invitationId,
        projectId,
        email: 'pending@example.com',
        role: 'admin',
        invitedBy: ownerUserId,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T01:00:00.000Z',
        invitedByUser: {
          id: ownerUserId,
          name: 'Owner User',
          email: 'owner@example.com'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/invitations/${invitationId}`,
      headers: {
        authorization: 'Bearer owner-update-invitation-token-123'
      },
      payload: {
        role: 'admin'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      invitationId,
      role: 'admin',
      invitedBy: ownerUserId
    });
  });
});

test('update project invitation rejects project viewers without membership-management access', async (t) => {
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'viewer-update-invitation-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/invitations/${invitationId}`,
      headers: {
        authorization: 'Bearer viewer-update-invitation-token-123'
      },
      payload: {
        role: 'editor'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('remove project invitation allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'owner-remove-invitation-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRemoveProjectInvitation: (input) => {
      capturedInput = input;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/invitations/${invitationId}`,
      headers: {
        authorization: 'Bearer owner-remove-invitation-token-123'
      }
    });

    assert.equal(res.statusCode, 204);
    assert.deepEqual(capturedInput, {
      projectId,
      invitationId
    });
  });
});

test('remove project invitation rejects project viewers without membership-management access', async (t) => {
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'viewer-remove-invitation-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/invitations/${invitationId}`,
      headers: {
        authorization: 'Bearer viewer-remove-invitation-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('redeliver project invitation allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'owner-redeliver-invitation-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRedeliverProjectInvitation: (input) => {
      capturedInput = input;
      return {
        invitation: {
          id: invitationId,
          projectId,
          email: 'pending@example.com',
          claimToken: 'claim-token-123',
          role: 'viewer',
          status: 'pending',
          invitedBy: ownerUserId,
          acceptedBy: null,
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T01:00:00.000Z',
          acceptedAt: null,
          cancelledAt: null,
          invitedByUser: {
            id: ownerUserId,
            name: 'Owner User',
            email: 'owner@example.com'
          },
          acceptedByUser: null
        },
        delivery: {
          status: 'delivered',
          message: 'Invitation delivery request completed successfully.',
          claimUrl: 'https://platform.example.com/invitations/claim-token-123',
          attemptedAt: '2026-03-26T01:00:00.000Z'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/invitations/${invitationId}/redeliver`,
      headers: {
        authorization: 'Bearer owner-redeliver-invitation-token-123'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      invitationId
    });
    assert.equal(JSON.parse(res.body).data.delivery.status, 'delivered');
  });
});

test('redeliver project invitation rejects project viewers without membership-management access', async (t) => {
  const invitationId = '00000000-0000-0000-0000-000000000055';

  await withProjectsRoutesApp(t, {
    token: 'viewer-redeliver-invitation-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/invitations/${invitationId}/redeliver`,
      headers: {
        authorization: 'Bearer viewer-redeliver-invitation-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('update project member role allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'owner-update-member-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onUpdateProjectMember: (input) => {
      capturedInput = input;
      return {
        id: 'member-3',
        projectId,
        userId: memberUserId,
        role: 'admin',
        invitedBy: ownerUserId,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T01:00:00.000Z',
        isOwner: false,
        user: {
          id: memberUserId,
          name: 'Member User',
          email: 'member@example.com'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/members/${memberUserId}`,
      headers: {
        authorization: 'Bearer owner-update-member-token-123'
      },
      payload: {
        role: 'admin'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      userId: memberUserId,
      role: 'admin'
    });
  });
});

test('update project member role rejects project viewers without membership-management access', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'viewer-update-member-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'PUT',
      url: `/v1/projects/${projectId}/members/${memberUserId}`,
      headers: {
        authorization: 'Bearer viewer-update-member-token-123'
      },
      payload: {
        role: 'editor'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('remove project member allows owner/project-admin access with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'owner-remove-member-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onRemoveProjectMember: (input) => {
      capturedInput = input;
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/members/${memberUserId}`,
      headers: {
        authorization: 'Bearer owner-remove-member-token-123'
      }
    });

    assert.equal(res.statusCode, 204);
    assert.deepEqual(capturedInput, {
      projectId,
      userId: memberUserId
    });
  });
});

test('remove project member rejects project viewers without membership-management access', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'viewer-remove-member-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'viewer' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/members/${memberUserId}`,
      headers: {
        authorization: 'Bearer viewer-remove-member-token-123'
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_MEMBERSHIP_MANAGEMENT');
  });
});

test('transfer project ownership allows current owners with projects:write scope', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  await withProjectsRoutesApp(t, {
    token: 'owner-transfer-ownership-token-123',
    actorUserId: ownerUserId,
    scopes: ['projects:write'],
    membershipRows: [],
    onTransferProjectOwnership: (input) => {
      capturedInput = input;
      return {
        id: 'member-3',
        projectId,
        userId: memberUserId,
        role: 'admin',
        invitedBy: ownerUserId,
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T01:00:00.000Z',
        isOwner: true,
        user: {
          id: memberUserId,
          name: 'Member User',
          email: 'member@example.com'
        }
      };
    }
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/ownership`,
      headers: {
        authorization: 'Bearer owner-transfer-ownership-token-123'
      },
      payload: {
        userId: memberUserId
      }
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedInput, {
      projectId,
      userId: memberUserId
    });
    assert.equal(JSON.parse(res.body).data.isOwner, true);
  });
});

test('transfer project ownership rejects project-admin members who are not the current owner', async (t) => {
  await withProjectsRoutesApp(t, {
    token: 'project-admin-transfer-ownership-token-123',
    actorUserId: memberUserId,
    scopes: ['projects:write'],
    membershipRows: [{ role: 'admin' }]
  }, async (app) => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/ownership`,
      headers: {
        authorization: 'Bearer project-admin-transfer-ownership-token-123'
      },
      payload: {
        userId: outsiderUserId
      }
    });

    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN_PROJECT_OWNERSHIP_TRANSFER');
  });
});
