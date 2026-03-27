import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { AuthService } = await import('./auth.service.js');
const { projectInvitations, projectMembers } = await import('../../db/schema.js');
const { UserEmailTakenError } = await import('../../server/domain-errors.js');

function createDbClientMock(options?: {
  selectRows?: unknown[];
  upsertRows?: unknown[];
  insertError?: unknown;
  pendingInvitationRows?: unknown[];
  membershipRows?: unknown[];
  onMembershipInsert?: (value: unknown) => void;
  onInvitationAccept?: (value: unknown) => void;
}) {
  const transactionClient = {
    select() {
      return {
        from(table: unknown) {
          if (table === projectInvitations) {
            return {
              innerJoin() {
                return {
                  where: async () => options?.pendingInvitationRows ?? []
                };
              }
            };
          }

          if (table === projectMembers) {
            return {
              where() {
                return {
                  limit: async () => options?.membershipRows ?? []
                };
              }
            };
          }

          return {
            where() {
              return {
                limit: async () => options?.selectRows ?? []
              };
            }
          };
        }
      };
    },
    insert(table: unknown) {
      if (table === projectMembers) {
        return {
          values(value: unknown) {
            options?.onMembershipInsert?.(value);
            return Promise.resolve([]);
          }
        };
      }

      return {
        values() {
          return {
            onConflictDoUpdate() {
              return {
                returning: async () => {
                  if (options?.insertError) {
                    throw options.insertError;
                  }

                  return options?.upsertRows ?? [];
                }
              };
            }
          };
        }
      };
    },
    update(table: unknown) {
      if (table === projectInvitations) {
        return {
          set(value: unknown) {
            options?.onInvitationAccept?.(value);
            return {
              where() {
                return Promise.resolve([]);
              }
            };
          }
        };
      }

      return {
        set() {
          return {
            where() {
              return Promise.resolve([]);
            }
          };
        }
      };
    }
  };

  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => options?.selectRows ?? []
              };
            }
          };
        }
      };
    },
    transaction(run: (tx: typeof transactionClient) => Promise<unknown>) {
      return run(transactionClient);
    }
  };
}

test('getViewer includes persisted user profile details when the user exists', async () => {
  const service = new AuthService(createDbClientMock({
    selectRows: [{
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Platform Operator',
      email: 'operator@example.com'
    }]
  }) as never);

  const viewer = await service.getViewer({
    userId: '00000000-0000-0000-0000-000000000010',
    role: 'user',
    scopes: ['projects:read'],
    authSource: 'database-token'
  });

  assert.deepEqual(viewer, {
    userId: '00000000-0000-0000-0000-000000000010',
    role: 'user',
    scopes: ['projects:read'],
    authSource: 'database-token',
    authMode: 'token',
    user: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Platform Operator',
      email: 'operator@example.com'
    }
  });
});

test('getViewer still returns actor identity when no persisted user record is present', async () => {
  const service = new AuthService(createDbClientMock() as never);

  const viewer = await service.getViewer({
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'admin',
    scopes: ['*'],
    authSource: 'dev-user-header'
  });

  assert.deepEqual(viewer, {
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'admin',
    scopes: ['*'],
    authSource: 'dev-user-header',
    authMode: 'development',
    user: null
  });
});

test('upsertViewerProfile creates or updates the persisted user profile for the actor', async () => {
  const service = new AuthService(createDbClientMock({
    upsertRows: [{
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Bootstrap Operator',
      email: 'bootstrap@example.com'
    }]
  }) as never);

  const viewer = await service.upsertViewerProfile({
    userId: '00000000-0000-0000-0000-000000000020',
    role: 'admin',
    scopes: ['*'],
    authSource: 'bootstrap-token'
  }, {
    name: 'Bootstrap Operator',
    email: 'bootstrap@example.com'
  });

  assert.deepEqual(viewer, {
    userId: '00000000-0000-0000-0000-000000000020',
    role: 'admin',
    scopes: ['*'],
    authSource: 'bootstrap-token',
    authMode: 'token',
    user: {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Bootstrap Operator',
      email: 'bootstrap@example.com'
    }
  });
});

test('upsertViewerProfile maps duplicate email conflicts to UserEmailTakenError', async () => {
  const service = new AuthService(createDbClientMock({
    insertError: {
      code: '23505',
      constraint: 'users_email_unique'
    }
  }) as never);

  await assert.rejects(
    () => service.upsertViewerProfile({
      userId: '00000000-0000-0000-0000-000000000021',
      role: 'user',
      scopes: ['projects:read'],
      authSource: 'dev-user-header'
    }, {
      name: 'Duplicate Email',
      email: 'taken@example.com'
    }),
    UserEmailTakenError
  );
});

test('upsertViewerProfile accepts pending project invitations that match the saved email', async () => {
  const insertedMemberships: unknown[] = [];
  const acceptedInvitationUpdates: unknown[] = [];

  const service = new AuthService(createDbClientMock({
    upsertRows: [{
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Bootstrap Operator',
      email: 'bootstrap@example.com'
    }],
    pendingInvitationRows: [{
      id: 'invite-1',
      projectId: 'project-1',
      role: 'editor',
      invitedBy: '00000000-0000-0000-0000-000000000099',
      projectName: 'Example Project'
    }],
    membershipRows: [],
    onMembershipInsert: (value) => {
      insertedMemberships.push(value);
    },
    onInvitationAccept: (value) => {
      acceptedInvitationUpdates.push(value);
    }
  }) as never);

  const viewer = await service.upsertViewerProfile({
    userId: '00000000-0000-0000-0000-000000000020',
    role: 'user',
    scopes: ['projects:read'],
    authSource: 'bootstrap-token'
  }, {
    name: 'Bootstrap Operator',
    email: 'Bootstrap@Example.com'
  });

  assert.deepEqual(insertedMemberships, [{
    projectId: 'project-1',
    userId: '00000000-0000-0000-0000-000000000020',
    role: 'editor',
    invitedBy: '00000000-0000-0000-0000-000000000099'
  }]);
  assert.equal(acceptedInvitationUpdates.length, 1);
  assert.deepEqual(viewer.acceptedProjectInvitations, [{
    projectId: 'project-1',
    projectName: 'Example Project',
    role: 'editor'
  }]);
  assert.equal(viewer.user?.email, 'bootstrap@example.com');
});
