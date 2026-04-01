import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  ensureProjectAuthorized,
  ensureProjectAccess,
  ensureProjectMembershipManagementAccess,
  ensureProjectOwnershipTransferAccess,
  ensureProjectDeletionAccess
} from './auth-utils.js';
import {
  ProjectNotFoundError,
  ForbiddenProjectAccessError,
  ForbiddenProjectMembershipManagementError,
  ForbiddenProjectOwnershipTransferError,
  ForbiddenProjectDeletionError
} from '../../server/domain-errors.js';
import type { AuthContext } from '../../plugins/auth-context.js';
import type { ProjectsService } from '../projects/projects.service.js';

describe('auth-utils project access checks', () => {
  const defaultActor = {
    userId: 'user-001',
    role: 'user' as const,
    scopes: [],
    authSource: 'token' as any
  } as unknown as AuthContext;

  const adminActor = {
    ...defaultActor,
    role: 'admin' as const,
    userId: 'admin-001'
  } as unknown as AuthContext;

  function createMockProjectsService(options: {
    projectOwnerId?: string;
    membershipRole?: 'admin' | 'member' | null;
  }) {
    // Partial mock for tests
    return {
      getProjectById: async (id: string) => {
        if (id !== 'proj-001') return null;
        return {
          id: 'proj-001',
          userId: options.projectOwnerId || 'owner-001'
        };
      },
      getMembership: async () => {
        if (options.membershipRole) {
          return { role: options.membershipRole };
        }
        return null;
      },
      checkMembership: async () => {
        return !!options.membershipRole;
      }
    } as unknown as ProjectsService;
  }

  describe('ensureProjectAuthorized', () => {
    it('throws ProjectNotFoundError if project does not exist', async () => {
      const service = createMockProjectsService({});
      await assert.rejects(
        () => ensureProjectAuthorized(service, { projectId: 'missing', actor: defaultActor, action: 'read' }),
        ProjectNotFoundError
      );
    });

    it('allows access for system admins regardless of membership', async () => {
      const service = createMockProjectsService({});
      const project = await ensureProjectAuthorized(service, {
        projectId: 'proj-001',
        actor: adminActor,
        action: 'delete_project'
      });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('allows access for project owners regardless of action', async () => {
      const service = createMockProjectsService({ projectOwnerId: defaultActor.userId });
      const actions: Array<'read' | 'manage_members' | 'transfer_ownership' | 'delete_project'> = [
        'read', 'manage_members', 'transfer_ownership', 'delete_project'
      ];
      for (const action of actions) {
        const project = await ensureProjectAuthorized(service, {
          projectId: 'proj-001',
          actor: defaultActor,
          action
        });
        assert.strictEqual(project.id, 'proj-001');
      }
    });

    it('throws ForbiddenProjectAccessError if actor is not an owner or member', async () => {
      const service = createMockProjectsService({ membershipRole: null });
      await assert.rejects(
        () => ensureProjectAuthorized(service, { projectId: 'proj-001', actor: defaultActor, action: 'read' }),
        ForbiddenProjectAccessError
      );
    });

    it('allows read access for regular members', async () => {
      const service = createMockProjectsService({ membershipRole: 'member' });
      const project = await ensureProjectAuthorized(service, {
        projectId: 'proj-001',
        actor: defaultActor,
        action: 'read'
      });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('throws ForbiddenProjectMembershipManagementError if non-admin member tries to manage members', async () => {
      const service = createMockProjectsService({ membershipRole: 'member' });
      await assert.rejects(
        () => ensureProjectAuthorized(service, { projectId: 'proj-001', actor: defaultActor, action: 'manage_members' }),
        ForbiddenProjectMembershipManagementError
      );
    });

    it('allows manage_members access for project admin members', async () => {
      const service = createMockProjectsService({ membershipRole: 'admin' });
      const project = await ensureProjectAuthorized(service, {
        projectId: 'proj-001',
        actor: defaultActor,
        action: 'manage_members'
      });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('throws ForbiddenProjectOwnershipTransferError if non-owner member tries to transfer ownership', async () => {
      const service = createMockProjectsService({ membershipRole: 'admin' });
      await assert.rejects(
        () => ensureProjectAuthorized(service, { projectId: 'proj-001', actor: defaultActor, action: 'transfer_ownership' }),
        ForbiddenProjectOwnershipTransferError
      );
    });

    it('throws ForbiddenProjectDeletionError if non-owner member tries to delete project', async () => {
      const service = createMockProjectsService({ membershipRole: 'admin' });
      await assert.rejects(
        () => ensureProjectAuthorized(service, { projectId: 'proj-001', actor: defaultActor, action: 'delete_project' }),
        ForbiddenProjectDeletionError
      );
    });
  });

  describe('Legacy wrappers', () => {
    it('ensureProjectAccess calls parameterized helper with action=read', async () => {
      const service = createMockProjectsService({ membershipRole: 'member' });
      const project = await ensureProjectAccess(service, { projectId: 'proj-001', actor: defaultActor });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('ensureProjectMembershipManagementAccess calls parameterized helper with action=manage_members', async () => {
      const service = createMockProjectsService({ membershipRole: 'admin' });
      const project = await ensureProjectMembershipManagementAccess(service, { projectId: 'proj-001', actor: defaultActor });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('ensureProjectOwnershipTransferAccess calls parameterized helper with action=transfer_ownership', async () => {
      const service = createMockProjectsService({ projectOwnerId: defaultActor.userId });
      const project = await ensureProjectOwnershipTransferAccess(service, { projectId: 'proj-001', actor: defaultActor });
      assert.strictEqual(project.id, 'proj-001');
    });

    it('ensureProjectDeletionAccess calls parameterized helper with action=delete_project', async () => {
      const service = createMockProjectsService({ projectOwnerId: defaultActor.userId });
      const project = await ensureProjectDeletionAccess(service, { projectId: 'proj-001', actor: defaultActor });
      assert.strictEqual(project.id, 'proj-001');
    });
  });
});
