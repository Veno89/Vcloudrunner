import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultProjectServices,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { env } = await import('../../config/env.js');
const { ProjectsRepository } = await import('./projects.repository.js');
const { ProjectsService } = await import('./projects.service.js');
const {
  buildProjectInvitationClaimUrl
} = await import('../../services/project-invitation-delivery.service.js');
const {
  ProjectDomainAlreadyExistsError,
  ProjectDomainDeactivationFailedError,
  ProjectDomainNotFoundError,
  ProjectDomainRemovalNotAllowedError,
  ProjectDomainReservedError,
  ProjectInvitationAlreadyExistsError,
  ProjectInvitationEmailMismatchError,
  ProjectInvitationNotFoundError,
  ProjectInvitationNotPendingError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberNotFoundError,
  ProjectNotFoundError
} = await import('../../server/domain-errors.js');
const { UserProfileRequiredError } = await import('../../server/domain-errors.js');

const baseInput = {
  userId: '00000000-0000-0000-0000-000000000010',
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

async function withEnvOverrides(
  overrides: Partial<typeof env>,
  run: () => Promise<void>
) {
  const originalValues = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, env[key as keyof typeof env]])
  );

  Object.assign(env, overrides);

  try {
    await run();
  } finally {
    Object.assign(env, originalValues);
  }
}

function createDeliveryStub() {
  return {
    async deliverInvitation(input: { invitation: { claimToken: string } }) {
      return {
        status: 'delivered' as const,
        message: 'Invitation delivery request completed successfully.',
        claimUrl: buildProjectInvitationClaimUrl(input.invitation.claimToken),
        attemptedAt: '2026-03-26T01:00:00.000Z'
      };
    }
  };
}

test('createProject defaults to one public app service when services are omitted', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  t.mock.method(ProjectsRepository.prototype, 'create', async (input: Record<string, unknown>) => {
    capturedInput = input as Record<string, unknown>;
    return {
      id: 'project-1',
      ...input
    } as any;
  });

  const service = new ProjectsService({} as never);
  const created = await service.createProject(baseInput);

  assert.deepEqual(capturedInput?.['services'], createDefaultProjectServices());
  assert.deepEqual((created as { services: unknown }).services, createDefaultProjectServices());
});

test('createProject preserves an explicit multi-service composition', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;
  const services: ProjectServiceDefinition[] = [
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
      name: 'worker',
      kind: 'worker',
      sourceRoot: 'apps/worker',
      exposure: 'internal'
    }
  ];

  t.mock.method(ProjectsRepository.prototype, 'create', async (input: Record<string, unknown>) => {
    capturedInput = input as Record<string, unknown>;
    return {
      id: 'project-2',
      ...input
    } as any;
  });

  const service = new ProjectsService({} as never);
  const created = await service.createProject({
    ...baseInput,
    services
  });

  assert.deepEqual(capturedInput?.['services'], services);
  assert.deepEqual((created as { services: unknown }).services, services);
});

test('listProjectDomains throws when the project does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.listProjectDomains('project-missing'),
    ProjectNotFoundError
  );
});

test('listProjectDomains classifies active, degraded, and stale route records', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () => ([
    {
      id: 'event-1',
      projectId: 'project-1',
      domainId: 'domain-active',
      kind: 'ownership',
      previousStatus: 'pending',
      nextStatus: 'verified',
      detail: 'DNS ownership verified for the custom host.',
      createdAt: new Date('2026-03-27T10:10:00.000Z')
    }
  ]));
  t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
    {
      id: 'domain-active',
      projectId: 'project-1',
      deploymentId: 'dep-active',
      host: 'active.example.test',
      targetPort: 3100,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      deploymentStatus: 'running',
      runtimeUrl: 'http://active.example.test',
      serviceName: 'frontend',
      serviceKind: 'web',
      serviceExposure: 'public'
    },
    {
      id: 'domain-degraded',
      projectId: 'project-1',
      deploymentId: 'dep-degraded',
      host: 'degraded.example.test',
      targetPort: 3200,
      createdAt: new Date('2026-03-27T11:00:00.000Z'),
      updatedAt: new Date('2026-03-27T11:00:00.000Z'),
      deploymentStatus: 'running',
      runtimeUrl: null,
      serviceName: 'frontend',
      serviceKind: 'web',
      serviceExposure: 'public'
    },
    {
      id: 'domain-stale',
      projectId: 'project-1',
      deploymentId: 'dep-stale',
      host: 'stale.example.test',
      targetPort: 3300,
      createdAt: new Date('2026-03-27T12:00:00.000Z'),
      updatedAt: new Date('2026-03-27T12:00:00.000Z'),
      deploymentStatus: 'failed',
      runtimeUrl: null,
      serviceName: 'frontend',
      serviceKind: 'web',
      serviceExposure: 'public'
    }
  ] as any));

  const service = new ProjectsService({} as never);
  const domains = await service.listProjectDomains('project-1');

  assert.deepEqual(
    domains.map((domain) => ({
      host: domain.host,
      routeStatus: domain.routeStatus
    })),
    [
      {
        host: 'active.example.test',
        routeStatus: 'active'
      },
      {
        host: 'degraded.example.test',
        routeStatus: 'degraded'
      },
      {
        host: 'stale.example.test',
        routeStatus: 'stale'
      }
    ]
  );
  assert.equal(
    domains[0]?.statusDetail,
    'Route is active and serving traffic from the current running deployment.'
  );
  assert.equal(
    domains[1]?.statusDetail,
    'Deployment is running, but no public runtime URL is currently active for this host.'
  );
  assert.equal(
    domains[2]?.statusDetail,
    'Route still points at a failed deployment record and should be redeployed.'
  );
  assert.equal(domains[0]?.recentEvents[0]?.kind, 'ownership');
  assert.equal(domains[0]?.recentEvents[0]?.nextStatus, 'verified');
  assert.equal(domains[1]?.recentEvents.length, 0);
});

test('listProjectDomains classifies undeployed custom domains as pending', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () => []);
  t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
    {
      id: 'domain-pending',
      projectId: 'project-1',
      deploymentId: null,
      host: 'api.example.com',
      targetPort: 3000,
      verificationToken: 'challenge-token',
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: null,
      serviceKind: null,
      serviceExposure: null
    }
  ] as any));

  const service = new ProjectsService({} as never);
  const domains = await service.listProjectDomains('project-1');

  assert.equal(domains[0]?.routeStatus, 'pending');
  assert.equal(domains[0]?.serviceName, 'app');
  assert.equal(domains[0]?.verificationStatus, 'pending');
  assert.equal(domains[0]?.ownershipStatus, 'pending');
  assert.equal(domains[0]?.tlsStatus, 'pending');
  assert.equal(domains[0]?.diagnosticsCheckedAt, null);
  assert.equal(domains[0]?.diagnosticsFreshnessStatus, 'unchecked');
  assert.equal(domains[0]?.claimState, 'publish-verification-record');
  assert.equal(domains[0]?.claimDnsRecordType, 'TXT');
  assert.equal(domains[0]?.claimDnsRecordName, '_vcloudrunner.api.example.com');
  assert.match(domains[0]?.claimDnsRecordValue ?? '', /^vcloudrunner-verify=/);
  assert.equal(domains[0]?.verificationDnsRecordType, 'TXT');
  assert.equal(domains[0]?.routingDnsRecordType, 'CNAME');
  assert.equal(domains[0]?.routingDnsRecordValue, 'example-project.platform.local');
  assert.equal(domains[0]?.verificationStatusChangedAt, null);
  assert.equal(domains[0]?.verificationVerifiedAt, null);
  assert.equal(domains[0]?.ownershipStatusChangedAt, null);
  assert.equal(domains[0]?.tlsStatusChangedAt, null);
  assert.equal(domains[0]?.ownershipVerifiedAt, null);
  assert.equal(domains[0]?.tlsReadyAt, null);
  assert.equal(
    domains[0]?.statusDetail,
    'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
  );
  assert.match(domains[0]?.verificationDetail ?? '', /Publish the TXT record/i);
  assert.match(domains[0]?.ownershipDetail ?? '', /No routing DNS check has been recorded yet/i);
  assert.match(domains[0]?.tlsDetail ?? '', /TLS checks run after this host is attached/i);
  assert.match(domains[0]?.diagnosticsFreshnessDetail ?? '', /have not been recorded/i);
});

test('listProjectDomains marks stored diagnostics as stale once they are older than the freshness window', async (t) => {
  await withEnvOverrides({
    PROJECT_DOMAIN_DIAGNOSTICS_STALE_MS: 60_000
  }, async () => {
    t.mock.method(Date, 'now', () => Date.parse('2026-03-28T12:00:00.000Z'));

    t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
      id: 'project-1',
      userId: baseInput.userId,
      slug: 'example-project',
      services: createDefaultProjectServices()
    } as any));
    t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () => []);
    t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
      {
        id: 'domain-stale-checks',
        projectId: 'project-1',
        deploymentId: 'dep-active',
        host: 'api.example.com',
        targetPort: 3000,
        ownershipStatus: 'verified',
        ownershipDetail: 'DNS ownership verified for the custom host.',
        tlsStatus: 'ready',
        tlsDetail: 'HTTPS is reachable and the certificate is valid.',
        diagnosticsCheckedAt: new Date('2026-03-28T11:58:00.000Z'),
        ownershipVerifiedAt: new Date('2026-03-28T11:58:00.000Z'),
        tlsReadyAt: new Date('2026-03-28T11:58:00.000Z'),
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T11:58:00.000Z'),
        deploymentStatus: 'running',
        runtimeUrl: 'https://api.example.com',
        serviceName: 'app',
        serviceKind: 'web',
        serviceExposure: 'public'
      }
    ] as any));

    const service = new ProjectsService({} as never);
    const domains = await service.listProjectDomains('project-1');

    assert.equal(domains[0]?.diagnosticsFreshnessStatus, 'stale');
    assert.match(domains[0]?.diagnosticsFreshnessDetail ?? '', /older than the current freshness window/i);
  });
});

test('listProjectDomains merges DNS and TLS diagnostics only when explicitly requested', async (t) => {
  const diagnosticsCalls: Array<{
    defaultHost: string;
    domains: Array<{
      host: string;
      routeStatus: 'active' | 'degraded' | 'stale' | 'pending';
    }>;
  }> = [];
  const persistedDiagnosticsUpdates: Array<{
    projectId: string;
    domainId: string;
    ownershipStatus: string;
    tlsStatus: string;
    diagnosticsCheckedAt: Date;
    ownershipStatusChangedAt: Date | null;
    tlsStatusChangedAt: Date | null;
    ownershipVerifiedAt: Date | null;
    tlsReadyAt: Date | null;
  }> = [];
  const persistedDomainEvents: Array<{
    domainId: string;
    kind: 'ownership' | 'tls';
    previousStatus: string | null;
    nextStatus: string;
  }> = [];

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () =>
    persistedDomainEvents.map((event, index) => ({
      id: `event-${index + 1}`,
      projectId: 'project-1',
      domainId: event.domainId,
      kind: event.kind,
      previousStatus: event.previousStatus,
      nextStatus: event.nextStatus,
      detail: `${event.kind} changed`,
      createdAt: new Date('2026-03-28T12:00:00.000Z')
    }))
  );
  t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
    {
      id: 'domain-active',
      projectId: 'project-1',
      deploymentId: 'dep-active',
      host: 'api.example.com',
      targetPort: 3100,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:05:00.000Z'),
      deploymentStatus: 'running',
      runtimeUrl: 'https://api.example.com',
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public'
    }
  ] as any));
  t.mock.method(ProjectsRepository.prototype, 'updateDomainDiagnostics', async (input: {
    projectId: string;
    domainId: string;
    ownershipStatus: string;
    tlsStatus: string;
    diagnosticsCheckedAt: Date;
    ownershipStatusChangedAt: Date | null;
    tlsStatusChangedAt: Date | null;
    ownershipVerifiedAt: Date | null;
    tlsReadyAt: Date | null;
  }) => {
    persistedDiagnosticsUpdates.push({
      projectId: input.projectId,
      domainId: input.domainId,
      ownershipStatus: input.ownershipStatus,
      tlsStatus: input.tlsStatus,
      diagnosticsCheckedAt: input.diagnosticsCheckedAt,
      ownershipStatusChangedAt: input.ownershipStatusChangedAt,
      tlsStatusChangedAt: input.tlsStatusChangedAt,
      ownershipVerifiedAt: input.ownershipVerifiedAt,
      tlsReadyAt: input.tlsReadyAt
    });
    return { id: input.domainId } as any;
  });
  t.mock.method(ProjectsRepository.prototype, 'addDomainEvents', async (input: Array<{
    domainId: string;
    kind: 'ownership' | 'tls';
    previousStatus: string | null;
    nextStatus: string;
  }>) => {
    persistedDomainEvents.push(...input);
    return input.map((event, index) => ({ id: `event-${index + 1}`, domainId: event.domainId })) as any;
  });

  const service = new ProjectsService(
    {} as never,
    undefined,
    {
      async inspectDomains(input) {
        diagnosticsCalls.push({
          defaultHost: input.defaultHost,
          domains: input.domains.map((domain) => ({
            host: domain.host,
            routeStatus: domain.routeStatus
          }))
        });

        return [{
          verificationStatus: 'verified',
          verificationDetail: 'Ownership challenge verified through TXT record _vcloudrunner.api.example.com.',
          ownershipStatus: 'verified',
          ownershipDetail: 'DNS ownership verified for the custom host.',
          tlsStatus: 'ready',
          tlsDetail: 'HTTPS is reachable and the certificate is valid.'
        }];
      }
    }
  );

  const domains = await service.listProjectDomains('project-1', {
    includeDiagnostics: true
  });

  assert.deepEqual(diagnosticsCalls, [{
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'api.example.com',
      routeStatus: 'active'
    }]
  }]);
  assert.equal(domains[0]?.ownershipStatus, 'verified');
  assert.equal(domains[0]?.tlsStatus, 'ready');
  assert.equal(domains[0]?.verificationStatus, 'verified');
  assert.equal(persistedDiagnosticsUpdates.length, 1);
  assert.deepEqual(persistedDiagnosticsUpdates[0]?.projectId, 'project-1');
  assert.deepEqual(persistedDiagnosticsUpdates[0]?.domainId, 'domain-active');
  assert.equal(persistedDiagnosticsUpdates[0]?.ownershipStatus, 'verified');
  assert.equal(persistedDiagnosticsUpdates[0]?.tlsStatus, 'ready');
  assert.ok(persistedDiagnosticsUpdates[0]?.diagnosticsCheckedAt instanceof Date);
  assert.ok(persistedDiagnosticsUpdates[0]?.ownershipStatusChangedAt instanceof Date);
  assert.ok(persistedDiagnosticsUpdates[0]?.tlsStatusChangedAt instanceof Date);
  assert.equal(domains[0]?.diagnosticsFreshnessStatus, 'fresh');
  assert.equal(domains[0]?.claimState, 'healthy');
  assert.equal(domains[0]?.recentEvents.length, 2);
  assert.equal(domains[0]?.recentEvents[0]?.kind, 'ownership');
  assert.equal(domains[0]?.recentEvents[1]?.kind, 'tls');
  assert.equal(domains[0]?.ownershipStatusChangedAt instanceof Date, true);
  assert.equal(domains[0]?.tlsStatusChangedAt instanceof Date, true);
  assert.ok(persistedDiagnosticsUpdates[0]?.ownershipVerifiedAt instanceof Date);
  assert.ok(persistedDiagnosticsUpdates[0]?.tlsReadyAt instanceof Date);
  assert.equal(domains[0]?.diagnosticsCheckedAt instanceof Date, true);
  assert.equal(domains[0]?.ownershipVerifiedAt instanceof Date, true);
  assert.equal(domains[0]?.tlsReadyAt instanceof Date, true);
});

test('listProjectDomains preserves prior verification timestamps when refreshed diagnostics are no longer healthy', async (t) => {
  const previousOwnershipStatusChangedAt = new Date('2026-03-27T08:00:00.000Z');
  const previousTlsStatusChangedAt = new Date('2026-03-27T08:30:00.000Z');
  const previousOwnershipVerifiedAt = new Date('2026-03-27T09:00:00.000Z');
  const previousTlsReadyAt = new Date('2026-03-27T09:30:00.000Z');
  const persistedDiagnosticsUpdates: Array<{
    ownershipStatusChangedAt: Date | null;
    tlsStatusChangedAt: Date | null;
    ownershipVerifiedAt: Date | null;
    tlsReadyAt: Date | null;
  }> = [];

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () => []);
  t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
    {
      id: 'domain-active',
      projectId: 'project-1',
      deploymentId: 'dep-active',
      host: 'api.example.com',
      targetPort: 3100,
      ownershipStatus: 'verified',
      ownershipDetail: 'DNS ownership verified for the custom host.',
      tlsStatus: 'ready',
      tlsDetail: 'HTTPS is reachable and the certificate is valid.',
      diagnosticsCheckedAt: new Date('2026-03-27T09:30:00.000Z'),
      ownershipStatusChangedAt: previousOwnershipStatusChangedAt,
      tlsStatusChangedAt: previousTlsStatusChangedAt,
      ownershipVerifiedAt: previousOwnershipVerifiedAt,
      tlsReadyAt: previousTlsReadyAt,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:05:00.000Z'),
      deploymentStatus: 'running',
      runtimeUrl: 'https://api.example.com',
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public'
    }
  ] as any));
  t.mock.method(ProjectsRepository.prototype, 'updateDomainDiagnostics', async (input: {
    ownershipStatusChangedAt: Date | null;
    tlsStatusChangedAt: Date | null;
    ownershipVerifiedAt: Date | null;
    tlsReadyAt: Date | null;
  }) => {
    persistedDiagnosticsUpdates.push({
      ownershipStatusChangedAt: input.ownershipStatusChangedAt,
      tlsStatusChangedAt: input.tlsStatusChangedAt,
      ownershipVerifiedAt: input.ownershipVerifiedAt,
      tlsReadyAt: input.tlsReadyAt
    });
    return { id: 'domain-active' } as any;
  });
  t.mock.method(ProjectsRepository.prototype, 'addDomainEvents', async () => []);

  const service = new ProjectsService(
    {} as never,
    undefined,
    {
      async inspectDomains() {
        return [{
          verificationStatus: 'verified',
          verificationDetail: 'Ownership challenge verified through TXT record _vcloudrunner.api.example.com.',
          ownershipStatus: 'mismatch',
          ownershipDetail: 'DNS resolves away from the platform target.',
          tlsStatus: 'pending',
          tlsDetail: 'HTTPS is not reachable yet.'
        }];
      }
    }
  );

  const domains = await service.listProjectDomains('project-1', {
    includeDiagnostics: true
  });

  assert.ok(persistedDiagnosticsUpdates[0]?.ownershipStatusChangedAt instanceof Date);
  assert.ok(persistedDiagnosticsUpdates[0]?.tlsStatusChangedAt instanceof Date);
  assert.equal(persistedDiagnosticsUpdates[0]?.ownershipVerifiedAt?.toISOString(), previousOwnershipVerifiedAt.toISOString());
  assert.equal(persistedDiagnosticsUpdates[0]?.tlsReadyAt?.toISOString(), previousTlsReadyAt.toISOString());
  assert.notEqual(
    persistedDiagnosticsUpdates[0]?.ownershipStatusChangedAt?.toISOString(),
    previousOwnershipStatusChangedAt.toISOString()
  );
  assert.notEqual(
    persistedDiagnosticsUpdates[0]?.tlsStatusChangedAt?.toISOString(),
    previousTlsStatusChangedAt.toISOString()
  );
  assert.equal(domains[0]?.ownershipStatus, 'mismatch');
  assert.equal(domains[0]?.tlsStatus, 'pending');
  assert.equal(domains[0]?.claimState, 'fix-dns');
  assert.equal(domains[0]?.verificationStatus, 'verified');
  assert.equal(domains[0]?.ownershipVerifiedAt?.toISOString(), previousOwnershipVerifiedAt.toISOString());
  assert.equal(domains[0]?.tlsReadyAt?.toISOString(), previousTlsReadyAt.toISOString());
});

test('createProjectDomain stores a pending custom domain claim for the public service', async (t) => {
  let capturedInput: Record<string, unknown> | null = null;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'createDomain', async (input: Record<string, unknown>) => {
    capturedInput = input;
    return {
      id: 'domain-1',
      projectId: input.projectId,
      deploymentId: null,
      host: input.host,
      targetPort: input.targetPort,
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: null,
      serviceKind: null,
      serviceExposure: null
    } as any;
  });

  const service = new ProjectsService({} as never);
  const domain = await service.createProjectDomain({
    projectId: 'project-1',
    host: 'API.Example.com.'
  });

  assert.ok(capturedInput);
  assert.equal(capturedInput['projectId'], 'project-1');
  assert.equal(capturedInput['host'], 'api.example.com');
  assert.equal(capturedInput['targetPort'], 3000);
  assert.match(String(capturedInput['verificationToken'] ?? ''), /^[a-f0-9]{36}$/);
  assert.equal(domain.routeStatus, 'pending');
  assert.equal(domain.host, 'api.example.com');
  assert.equal(domain.serviceName, 'app');
});

test('createProjectDomain rejects reserved platform hosts', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.createProjectDomain({
      projectId: 'project-1',
      host: 'example-project.platform.local'
    }),
    ProjectDomainReservedError
  );
});

test('createProjectDomain maps duplicate host conflicts to ProjectDomainAlreadyExistsError', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'createDomain', async () => {
    throw {
      code: '23505',
      constraint: 'domains_host_unique'
    };
  });

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.createProjectDomain({
      projectId: 'project-1',
      host: 'api.example.com'
    }),
    ProjectDomainAlreadyExistsError
  );
});

test('verifyProjectDomainClaim refreshes the targeted custom domain only', async (t) => {
  const diagnosticsCalls: Array<{
    defaultHost: string;
    domains: Array<{
      host: string;
      routeStatus: 'active' | 'degraded' | 'stale' | 'pending';
      verificationToken: string | null;
    }>;
  }> = [];

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listRecentDomainEvents', async () => []);
  t.mock.method(ProjectsRepository.prototype, 'listDomains', async () => ([
    {
      id: 'domain-verify',
      projectId: 'project-1',
      deploymentId: null,
      host: 'api.example.com',
      targetPort: 3000,
      verificationToken: 'challenge-token',
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public'
    },
    {
      id: 'domain-other',
      projectId: 'project-1',
      deploymentId: null,
      host: 'www.example.com',
      targetPort: 3000,
      verificationToken: 'other-token',
      createdAt: new Date('2026-03-27T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T10:00:00.000Z'),
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: 'app',
      serviceKind: 'web',
      serviceExposure: 'public'
    }
  ] as any));
  t.mock.method(ProjectsRepository.prototype, 'updateDomainDiagnostics', async () => ({ id: 'domain-verify' } as any));
  t.mock.method(ProjectsRepository.prototype, 'addDomainEvents', async () => []);

  const service = new ProjectsService(
    {} as never,
    undefined,
    {
      async inspectDomains(input) {
        diagnosticsCalls.push({
          defaultHost: input.defaultHost,
          domains: input.domains.map((domain) => ({
            host: domain.host,
            routeStatus: domain.routeStatus,
            verificationToken: domain.verificationToken
          }))
        });

        return [{
          verificationStatus: 'verified',
          verificationDetail: 'Ownership challenge verified through TXT record _vcloudrunner.api.example.com.',
          ownershipStatus: 'pending',
          ownershipDetail: 'No public DNS records were found yet. Point this host at example-project.platform.local to verify ownership.',
          tlsStatus: 'pending',
          tlsDetail: 'TLS will be checked after this host is attached to a running deployment route.'
        }];
      }
    }
  );

  const domain = await service.verifyProjectDomainClaim({
    projectId: 'project-1',
    domainId: 'domain-verify'
  });

  assert.deepEqual(diagnosticsCalls, [{
    defaultHost: 'example-project.platform.local',
    domains: [{
      host: 'api.example.com',
      routeStatus: 'pending',
      verificationToken: 'challenge-token'
    }]
  }]);
  assert.equal(domain.id, 'domain-verify');
  assert.equal(domain.verificationStatus, 'verified');
  assert.equal(domain.claimState, 'configure-dns');
});

test('removeProjectDomain rejects attempts to remove the platform default host', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => ({
    id: 'domain-default',
    projectId: 'project-1',
    deploymentId: 'dep-1',
    host: 'example-project.platform.local',
    targetPort: 3000,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deploymentStatus: 'running',
    runtimeUrl: 'http://example-project.platform.local',
    serviceName: 'app',
    serviceKind: 'web',
    serviceExposure: 'public'
  } as any));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectDomain({
      projectId: 'project-1',
      domainId: 'domain-default'
    }),
    ProjectDomainReservedError
  );
});

test('removeProjectDomain throws when the domain claim does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectDomain({
      projectId: 'project-1',
      domainId: 'domain-missing'
    }),
    ProjectDomainNotFoundError
  );
});

test('removeProjectDomain rejects removing a custom domain that is attached to a queued deployment snapshot', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => ({
    id: 'domain-custom-active',
    projectId: 'project-1',
    deploymentId: 'dep-1',
    host: 'api.example.com',
    targetPort: 3000,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deploymentStatus: 'queued',
    runtimeUrl: 'http://example-project.platform.local',
    serviceName: 'app',
    serviceKind: 'web',
    serviceExposure: 'public'
  } as any));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectDomain({
      projectId: 'project-1',
      domainId: 'domain-custom-active'
    }),
    ProjectDomainRemovalNotAllowedError
  );
});

test('removeProjectDomain deactivates the live route before deleting an attached custom domain', async (t) => {
  let removeCallCount = 0;
  const deactivatedHosts: string[] = [];

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => ({
    id: 'domain-custom-active',
    projectId: 'project-1',
    deploymentId: 'dep-1',
    host: 'api.example.com',
    targetPort: 3000,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deploymentStatus: 'running',
    runtimeUrl: 'http://example-project.platform.local',
    serviceName: 'app',
    serviceKind: 'web',
    serviceExposure: 'public'
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'removeDomain', async () => {
    removeCallCount += 1;
    return { id: 'domain-custom-active' } as any;
  });

  const service = new ProjectsService(
    {} as never,
    undefined,
    undefined,
    {
      deactivateRoute: async ({ host }) => {
        deactivatedHosts.push(host);
      }
    }
  );

  await service.removeProjectDomain({
    projectId: 'project-1',
    domainId: 'domain-custom-active'
  });

  assert.deepEqual(deactivatedHosts, ['api.example.com']);
  assert.equal(removeCallCount, 1);
});

test('removeProjectDomain surfaces live route deactivation failures without deleting the domain claim', async (t) => {
  let removeCallCount = 0;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => ({
    id: 'domain-custom-active',
    projectId: 'project-1',
    deploymentId: 'dep-1',
    host: 'api.example.com',
    targetPort: 3000,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deploymentStatus: 'running',
    runtimeUrl: 'http://example-project.platform.local',
    serviceName: 'app',
    serviceKind: 'web',
    serviceExposure: 'public'
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'removeDomain', async () => {
    removeCallCount += 1;
    return { id: 'domain-custom-active' } as any;
  });

  const service = new ProjectsService(
    {} as never,
    undefined,
    undefined,
    {
      deactivateRoute: async () => {
        throw new Error('caddy unavailable');
      }
    }
  );

  await assert.rejects(
    () => service.removeProjectDomain({
      projectId: 'project-1',
      domainId: 'domain-custom-active'
    }),
    ProjectDomainDeactivationFailedError
  );

  assert.equal(removeCallCount, 0);
});

test('removeProjectDomain deletes a custom domain claim', async (t) => {
  let removeCallCount = 0;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId,
    slug: 'example-project',
    services: createDefaultProjectServices()
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findDomainById', async () => ({
    id: 'domain-custom',
    projectId: 'project-1',
    deploymentId: null,
    host: 'api.example.com',
    targetPort: 3000,
    createdAt: new Date('2026-03-27T10:00:00.000Z'),
    updatedAt: new Date('2026-03-27T10:00:00.000Z'),
    deploymentStatus: null,
    runtimeUrl: null,
    serviceName: null,
    serviceKind: null,
    serviceExposure: null
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'removeDomain', async () => {
    removeCallCount += 1;
    return { id: 'domain-custom' } as any;
  });

  const service = new ProjectsService({} as never);
  await service.removeProjectDomain({
    projectId: 'project-1',
    domainId: 'domain-custom'
  });

  assert.equal(removeCallCount, 1);
});

test('inviteProjectMember stores a pending invitation when the target email has no persisted user yet', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserByEmail', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findActiveInvitationByEmail', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'addInvitation', async (input: Record<string, unknown>) => ({
    id: 'invite-1',
    projectId: input.projectId,
    email: input.email,
    claimToken: input.claimToken,
    role: input.role,
    status: 'pending',
    invitedBy: input.invitedBy,
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z')
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async (claimToken: string) => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'missing@example.com',
    claimToken,
    role: 'viewer',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: null
  }));

  const service = new ProjectsService({} as never, createDeliveryStub());
  const result = await service.inviteProjectMember({
    projectId: 'project-1',
    email: 'missing@example.com',
    role: 'viewer',
    invitedBy: baseInput.userId
  });

  assert.equal(result.kind, 'invitation');
  if (result.kind !== 'invitation') {
    assert.fail('expected a pending invitation result');
  }

  assert.deepEqual(result, {
    kind: 'invitation',
    invitation: {
      id: 'invite-1',
      projectId: 'project-1',
      email: 'missing@example.com',
      claimToken: result.invitation.claimToken,
      role: 'viewer',
      status: 'pending',
      invitedBy: baseInput.userId,
      acceptedBy: null,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      cancelledAt: null,
      invitedByUser: null,
      acceptedByUser: null
    },
    delivery: {
      status: 'delivered',
      message: 'Invitation delivery request completed successfully.',
      claimUrl: `http://platform.example.com/invitations/${result.invitation.claimToken}`,
      attemptedAt: '2026-03-26T01:00:00.000Z'
    }
  });
  assert.match(result.invitation.claimToken, /^[a-f0-9]{36}$/);
});

test('inviteProjectMember throws when the target user already owns the project', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserByEmail', async () => ({
    id: baseInput.userId,
    name: 'Owner User',
    email: 'owner@example.com'
  }));
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.inviteProjectMember({
      projectId: 'project-1',
      email: 'owner@example.com',
      role: 'viewer',
      invitedBy: baseInput.userId
    }),
    ProjectMemberAlreadyExistsError
  );
});

test('inviteProjectMember creates a project membership for an existing persisted user', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserByEmail', async () => ({
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Invited User',
    email: 'invitee@example.com'
  }));
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMembership', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'findActiveInvitationByEmail', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'addMember', async (input: Record<string, unknown>) => ({
    id: 'member-1',
    projectId: input.projectId,
    userId: input.userId,
    role: input.role,
    invitedBy: input.invitedBy,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z')
  } as any));

  const service = new ProjectsService({} as never);
  const result = await service.inviteProjectMember({
    projectId: 'project-1',
    email: 'invitee@example.com',
    role: 'editor',
    invitedBy: baseInput.userId
  });

  assert.deepEqual(result, {
    kind: 'member',
    member: {
      id: 'member-1',
      projectId: 'project-1',
      userId: '00000000-0000-0000-0000-000000000099',
      role: 'editor',
      invitedBy: baseInput.userId,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      isOwner: false,
      user: {
        id: '00000000-0000-0000-0000-000000000099',
        name: 'Invited User',
        email: 'invitee@example.com'
      }
    }
  });
});

test('inviteProjectMember rejects duplicate pending invitations for the same project email', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserByEmail', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findActiveInvitationByEmail', async () => ({
    id: 'invite-1'
  } as any));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.inviteProjectMember({
      projectId: 'project-1',
      email: 'missing@example.com',
      role: 'viewer',
      invitedBy: baseInput.userId
    }),
    ProjectInvitationAlreadyExistsError
  );
});

test('updateProjectInvitation throws when the pending invitation does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.updateProjectInvitation({
      projectId: 'project-1',
      invitationId: '00000000-0000-0000-0000-000000000099',
      role: 'editor',
      invitedBy: baseInput.userId
    }),
    ProjectInvitationNotFoundError
  );
});

test('updateProjectInvitation refreshes and returns the pending invitation', async (t) => {
  const invitationId = '00000000-0000-0000-0000-000000000099';
  let currentRole: 'viewer' | 'editor' | 'admin' = 'viewer';
  let currentUpdatedAt = new Date('2026-03-26T00:00:00.000Z');

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => ({
    id: invitationId,
    projectId: 'project-1',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: currentRole,
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: currentUpdatedAt,
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: null
  }));
  t.mock.method(ProjectsRepository.prototype, 'updateInvitation', async (input: Record<string, unknown>) => {
    currentRole = input.role as 'viewer' | 'editor' | 'admin';
    currentUpdatedAt = new Date('2026-03-26T02:00:00.000Z');

    return {
      id: invitationId
    } as any;
  });

  const service = new ProjectsService({} as never);
  const invitation = await service.updateProjectInvitation({
    projectId: 'project-1',
    invitationId,
    role: 'admin',
    invitedBy: baseInput.userId
  });

  assert.equal(invitation.role, 'admin');
  assert.equal(invitation.email, 'pending@example.com');
});

test('removeProjectInvitation throws when the pending invitation does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectInvitation({
      projectId: 'project-1',
      invitationId: '00000000-0000-0000-0000-000000000099'
    }),
    ProjectInvitationNotFoundError
  );
});

test('removeProjectInvitation deletes an existing pending invitation', async (t) => {
  let removeCallCount = 0;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => ({
    id: '00000000-0000-0000-0000-000000000099',
    projectId: 'project-1',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'viewer',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: null
  }));
  t.mock.method(ProjectsRepository.prototype, 'cancelInvitation', async () => {
    removeCallCount += 1;
    return { id: 'invite-1' } as any;
  });

  const service = new ProjectsService({} as never);
  await service.removeProjectInvitation({
    projectId: 'project-1',
    invitationId: '00000000-0000-0000-0000-000000000099'
  });

  assert.equal(removeCallCount, 1);
});

test('redeliverProjectInvitation returns delivery details for a pending invitation', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'viewer',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: null
  }));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'viewer',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: null
  }));

  const service = new ProjectsService({} as never, createDeliveryStub());
  const result = await service.redeliverProjectInvitation({
    projectId: 'project-1',
    invitationId: 'invite-1'
  });

  assert.equal(result.invitation.id, 'invite-1');
  assert.equal(result.delivery.status, 'delivered');
  assert.equal(result.delivery.claimUrl, 'http://platform.example.com/invitations/claim-token-123');
});

test('redeliverProjectInvitation rejects invitations that are no longer pending', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findInvitationDetails', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'viewer',
    status: 'accepted',
    invitedBy: baseInput.userId,
    acceptedBy: '00000000-0000-0000-0000-000000000099',
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T01:00:00.000Z'),
    acceptedAt: new Date('2026-03-26T01:00:00.000Z'),
    cancelledAt: null,
    invitedByUser: null,
    acceptedByUser: null
  }));

  const service = new ProjectsService({} as never, createDeliveryStub());

  await assert.rejects(
    () => service.redeliverProjectInvitation({
      projectId: 'project-1',
      invitationId: 'invite-1'
    }),
    ProjectInvitationNotPendingError
  );
});

test('getProjectInvitationClaim throws when the claim token is unknown', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.getProjectInvitationClaim('claim-token-123'),
    ProjectInvitationNotFoundError
  );
});

test('acceptProjectInvitationClaim rejects actors without a persisted user profile', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'editor',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: null,
    acceptedByUser: null
  }));
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserById', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.acceptProjectInvitationClaim({
      claimToken: 'claim-token-123',
      actorUserId: '00000000-0000-0000-0000-000000000099'
    }),
    UserProfileRequiredError
  );
});

test('acceptProjectInvitationClaim rejects actors whose stored email does not match the invite', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'editor',
    status: 'pending',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    invitedByUser: null,
    acceptedByUser: null
  }));
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserById', async () => ({
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Mismatch User',
    email: 'different@example.com'
  }));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.acceptProjectInvitationClaim({
      claimToken: 'claim-token-123',
      actorUserId: '00000000-0000-0000-0000-000000000099'
    }),
    ProjectInvitationEmailMismatchError
  );
});

test('acceptProjectInvitationClaim accepts a pending invitation for the matching persisted user', async (t) => {
  let membershipInsertCount = 0;
  let acceptanceCount = 0;
  let currentStatus: 'pending' | 'accepted' = 'pending';
  let currentAcceptedBy: string | null = null;
  let currentAcceptedAt: Date | null = null;

  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'editor',
    status: currentStatus,
    invitedBy: baseInput.userId,
    acceptedBy: currentAcceptedBy,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: currentAcceptedAt ?? new Date('2026-03-26T00:00:00.000Z'),
    acceptedAt: currentAcceptedAt,
    cancelledAt: null,
    invitedByUser: {
      id: baseInput.userId,
      name: 'Owner User',
      email: 'owner@example.com'
    },
    acceptedByUser: currentAcceptedBy
      ? {
          id: currentAcceptedBy,
          name: 'Pending User',
          email: 'pending@example.com'
        }
      : null
  }));
  t.mock.method(ProjectsRepository.prototype, 'findPersistedUserById', async () => ({
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Pending User',
    email: 'pending@example.com'
  }));
  t.mock.method(ProjectsRepository.prototype, 'findMembership', async () => null);
  t.mock.method(ProjectsRepository.prototype, 'addMember', async () => {
    membershipInsertCount += 1;
    return {} as any;
  });
  t.mock.method(ProjectsRepository.prototype, 'acceptInvitation', async (_invitationId: string, acceptedByUserId: string) => {
    acceptanceCount += 1;
    currentStatus = 'accepted';
    currentAcceptedBy = acceptedByUserId;
    currentAcceptedAt = new Date('2026-03-26T01:00:00.000Z');
    return { id: 'invite-1' } as any;
  });

  const service = new ProjectsService({} as never);
  const invitation = await service.acceptProjectInvitationClaim({
    claimToken: 'claim-token-123',
    actorUserId: '00000000-0000-0000-0000-000000000099'
  });

  assert.equal(membershipInsertCount, 1);
  assert.equal(acceptanceCount, 1);
  assert.equal(invitation.status, 'accepted');
  assert.equal(invitation.acceptedBy, '00000000-0000-0000-0000-000000000099');
});

test('acceptProjectInvitationClaim rejects invitations that are no longer pending', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findInvitationClaimByToken', async () => ({
    id: 'invite-1',
    projectId: 'project-1',
    projectName: 'Example Project',
    projectSlug: 'example-project',
    email: 'pending@example.com',
    claimToken: 'claim-token-123',
    role: 'editor',
    status: 'cancelled',
    invitedBy: baseInput.userId,
    acceptedBy: null,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T02:00:00.000Z'),
    acceptedAt: null,
    cancelledAt: new Date('2026-03-26T02:00:00.000Z'),
    invitedByUser: null,
    acceptedByUser: null
  }));

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.acceptProjectInvitationClaim({
      claimToken: 'claim-token-123',
      actorUserId: '00000000-0000-0000-0000-000000000099'
    }),
    ProjectInvitationNotPendingError
  );
});

test('updateProjectMemberRole rejects changes to the owner membership', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));

  const { ProjectOwnerMembershipImmutableError } = await import('../../server/domain-errors.js');
  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.updateProjectMemberRole({
      projectId: 'project-1',
      userId: baseInput.userId,
      role: 'viewer'
    }),
    ProjectOwnerMembershipImmutableError
  );
});

test('updateProjectMemberRole throws when the membership does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.updateProjectMemberRole({
      projectId: 'project-1',
      userId: '00000000-0000-0000-0000-000000000099',
      role: 'admin'
    }),
    ProjectMemberNotFoundError
  );
});

test('updateProjectMemberRole updates and returns the refreshed membership', async (t) => {
  const targetUserId = '00000000-0000-0000-0000-000000000099';
  let currentRole: 'viewer' | 'editor' | 'admin' = 'viewer';

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async () => ({
    id: 'member-1',
    projectId: 'project-1',
    userId: targetUserId,
    role: currentRole,
    invitedBy: baseInput.userId,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    isOwner: false,
    user: {
      id: targetUserId,
      name: 'Member User',
      email: 'member@example.com'
    }
  }));
  t.mock.method(ProjectsRepository.prototype, 'updateMemberRole', async (input: Record<string, unknown>) => {
    currentRole = input.role as 'viewer' | 'editor' | 'admin';
    return {
      id: 'member-1',
      projectId: input.projectId,
      userId: input.userId,
      role: currentRole
    } as any;
  });

  const service = new ProjectsService({} as never);
  const member = await service.updateProjectMemberRole({
    projectId: 'project-1',
    userId: targetUserId,
    role: 'admin'
  });

  assert.equal(member.role, 'admin');
  assert.equal(member.user.email, 'member@example.com');
});

test('removeProjectMember rejects removal of the owner membership', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));

  const { ProjectOwnerMembershipImmutableError } = await import('../../server/domain-errors.js');
  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectMember({
      projectId: 'project-1',
      userId: baseInput.userId
    }),
    ProjectOwnerMembershipImmutableError
  );
});

test('removeProjectMember throws when the membership does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.removeProjectMember({
      projectId: 'project-1',
      userId: '00000000-0000-0000-0000-000000000099'
    }),
    ProjectMemberNotFoundError
  );
});

test('removeProjectMember deletes an existing non-owner membership', async (t) => {
  let removeCallCount = 0;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async () => ({
    id: 'member-1',
    projectId: 'project-1',
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'editor',
    invitedBy: baseInput.userId,
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    isOwner: false,
    user: {
      id: '00000000-0000-0000-0000-000000000099',
      name: 'Member User',
      email: 'member@example.com'
    }
  }));
  t.mock.method(ProjectsRepository.prototype, 'removeMember', async () => {
    removeCallCount += 1;
    return { id: 'member-1' } as any;
  });

  const service = new ProjectsService({} as never);
  await service.removeProjectMember({
    projectId: 'project-1',
    userId: '00000000-0000-0000-0000-000000000099'
  });

  assert.equal(removeCallCount, 1);
});

test('transferProjectOwnership throws when the target membership does not exist', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async () => null);

  const service = new ProjectsService({} as never);

  await assert.rejects(
    () => service.transferProjectOwnership({
      projectId: 'project-1',
      userId: '00000000-0000-0000-0000-000000000099'
    }),
    ProjectMemberNotFoundError
  );
});

test('transferProjectOwnership updates the owner and returns the refreshed owner membership', async (t) => {
  const nextOwnerUserId = '00000000-0000-0000-0000-000000000099';
  let projectOwnerUserId = baseInput.userId;
  let transferCallCount = 0;

  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: projectOwnerUserId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'findMemberDetails', async (_projectId: string, userId: string) => (
    userId === nextOwnerUserId
      ? {
          id: 'member-2',
          projectId: 'project-1',
          userId,
          role: 'viewer',
          invitedBy: baseInput.userId,
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
          isOwner: false,
          user: {
            id: userId,
            name: 'Next Owner',
            email: 'next-owner@example.com'
          }
        }
      : null
  ));
  t.mock.method(ProjectsRepository.prototype, 'transferOwnership', async (input: Record<string, unknown>) => {
    transferCallCount += 1;
    projectOwnerUserId = input.nextOwnerUserId as string;
    return { id: input.projectId } as any;
  });
  t.mock.method(ProjectsRepository.prototype, 'listMembers', async () => ([
    {
      id: 'member-1',
      projectId: 'project-1',
      userId: baseInput.userId,
      role: 'admin',
      invitedBy: null,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T01:00:00.000Z'),
      isOwner: false,
      user: {
        id: baseInput.userId,
        name: 'Owner User',
        email: 'owner@example.com'
      }
    },
    {
      id: 'member-2',
      projectId: 'project-1',
      userId: nextOwnerUserId,
      role: 'admin',
      invitedBy: baseInput.userId,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T01:00:00.000Z'),
      isOwner: true,
      user: {
        id: nextOwnerUserId,
        name: 'Next Owner',
        email: 'next-owner@example.com'
      }
    }
  ] as any));

  const service = new ProjectsService({} as never);
  const member = await service.transferProjectOwnership({
    projectId: 'project-1',
    userId: nextOwnerUserId
  });

  assert.equal(transferCallCount, 1);
  assert.equal(member.userId, nextOwnerUserId);
  assert.equal(member.isOwner, true);
  assert.equal(member.role, 'admin');
});

test('transferProjectOwnership is idempotent when the target already owns the project', async (t) => {
  t.mock.method(ProjectsRepository.prototype, 'findById', async () => ({
    id: 'project-1',
    userId: baseInput.userId
  } as any));
  t.mock.method(ProjectsRepository.prototype, 'listMembers', async () => ([
    {
      id: 'member-1',
      projectId: 'project-1',
      userId: baseInput.userId,
      role: 'admin',
      invitedBy: null,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T01:00:00.000Z'),
      isOwner: true,
      user: {
        id: baseInput.userId,
        name: 'Owner User',
        email: 'owner@example.com'
      }
    }
  ] as any));
  let transferCallCount = 0;
  t.mock.method(ProjectsRepository.prototype, 'transferOwnership', async () => {
    transferCallCount += 1;
    assert.fail('ownership should not be rewritten when it already belongs to the target user');
  });

  const service = new ProjectsService({} as never);
  const member = await service.transferProjectOwnership({
    projectId: 'project-1',
    userId: baseInput.userId
  });

  assert.equal(member.userId, baseInput.userId);
  assert.equal(member.isOwner, true);
  assert.equal(transferCallCount, 0);
});
