import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultProjectServices,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { ProjectsRepository } = await import('./projects.repository.js');
const { ProjectsService } = await import('./projects.service.js');
const {
  buildProjectInvitationClaimUrl
} = await import('../../services/project-invitation-delivery.service.js');
const {
  ProjectInvitationAlreadyExistsError,
  ProjectInvitationEmailMismatchError,
  ProjectInvitationNotFoundError,
  ProjectInvitationNotPendingError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberNotFoundError
} = await import('../../server/domain-errors.js');
const { UserProfileRequiredError } = await import('../../server/domain-errors.js');

const baseInput = {
  userId: '00000000-0000-0000-0000-000000000010',
  name: 'Example Project',
  slug: 'example-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

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
