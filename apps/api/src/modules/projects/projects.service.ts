import { randomBytes } from 'node:crypto';
import type { DbClient } from '../../db/client.js';
import { normalizeProjectServices } from '@vcloudrunner/shared-types';
import {
  ProjectInvitationAlreadyExistsError,
  ProjectInvitationEmailMismatchError,
  ProjectInvitationNotFoundError,
  ProjectInvitationNotPendingError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberNotFoundError,
  ProjectOwnerMembershipImmutableError,
  ProjectNotFoundError,
  ProjectSlugTakenError,
  UserProfileRequiredError
} from '../../server/domain-errors.js';
import {
  disabledProjectInvitationDeliveryService,
  type ProjectInvitationDeliveryResult,
  type ProjectInvitationDeliveryService
} from '../../services/project-invitation-delivery.service.js';

interface PostgresError {
  code?: string;
  constraint?: string;
}
import {
  ProjectsRepository,
  type CreateProjectInput,
  type ProjectInvitationClaimRecord,
  type ProjectInvitationRecord,
  type ProjectMemberRecord
} from './projects.repository.js';

function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function createInvitationClaimToken() {
  return randomBytes(18).toString('hex');
}

export type ProjectInviteResult =
  | {
      kind: 'member';
      member: ProjectMemberRecord;
    }
  | {
      kind: 'invitation';
      invitation: ProjectInvitationRecord;
      delivery: ProjectInvitationDeliveryResult;
    };

export interface ProjectInvitationRedeliveryResult {
  invitation: ProjectInvitationRecord;
  delivery: ProjectInvitationDeliveryResult;
}

export class ProjectsService {
  private readonly repository: ProjectsRepository;
  private readonly invitationDelivery: ProjectInvitationDeliveryService;

  constructor(
    db: DbClient,
    invitationDelivery: ProjectInvitationDeliveryService = disabledProjectInvitationDeliveryService
  ) {
    this.repository = new ProjectsRepository(db);
    this.invitationDelivery = invitationDelivery;
  }

  async createProject(input: CreateProjectInput) {
    try {
      return await this.repository.create({
        ...input,
        services: normalizeProjectServices(input.services)
      });
    } catch (error) {
      const pgError = error as PostgresError;
      if (pgError.code === '23505' && pgError.constraint === 'projects_slug_unique') {
        throw new ProjectSlugTakenError();
      }

      throw error;
    }
  }

  listProjectsByUser(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  getProjectById(projectId: string) {
    return this.repository.findById(projectId);
  }

  checkMembership(projectId: string, userId: string) {
    return this.repository.checkMembership(projectId, userId);
  }

  getMembership(projectId: string, userId: string) {
    return this.repository.findMembership(projectId, userId);
  }

  listProjectMembers(projectId: string) {
    return this.repository.listMembers(projectId);
  }

  listProjectInvitations(projectId: string) {
    return this.repository.listInvitations(projectId);
  }

  async getProjectInvitationClaim(claimToken: string): Promise<ProjectInvitationClaimRecord> {
    const invitation = await this.repository.findInvitationClaimByToken(claimToken);
    if (!invitation) {
      throw new ProjectInvitationNotFoundError();
    }

    return invitation;
  }

  async updateProjectInvitation(input: {
    projectId: string;
    invitationId: string;
    role: 'viewer' | 'editor' | 'admin';
    invitedBy: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const existingInvitation = await this.repository.findInvitationDetails(
      input.projectId,
      input.invitationId
    );
    if (!existingInvitation || existingInvitation.status !== 'pending') {
      throw new ProjectInvitationNotFoundError();
    }

    const updatedRecord = await this.repository.updateInvitation(input);
    if (!updatedRecord) {
      throw new ProjectInvitationNotFoundError();
    }

    const updatedInvitation = await this.repository.findInvitationDetails(
      input.projectId,
      input.invitationId
    );
    if (!updatedInvitation || updatedInvitation.status !== 'pending') {
      throw new ProjectInvitationNotFoundError();
    }

    return updatedInvitation;
  }

  async removeProjectInvitation(input: {
    projectId: string;
    invitationId: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const existingInvitation = await this.repository.findInvitationDetails(
      input.projectId,
      input.invitationId
    );
    if (!existingInvitation || existingInvitation.status !== 'pending') {
      throw new ProjectInvitationNotFoundError();
    }

    const cancelledRecord = await this.repository.cancelInvitation(input.projectId, input.invitationId);
    if (!cancelledRecord) {
      throw new ProjectInvitationNotFoundError();
    }
  }

  async redeliverProjectInvitation(input: {
    projectId: string;
    invitationId: string;
  }): Promise<ProjectInvitationRedeliveryResult> {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const invitation = await this.repository.findInvitationDetails(input.projectId, input.invitationId);
    if (!invitation) {
      throw new ProjectInvitationNotFoundError();
    }

    if (invitation.status !== 'pending') {
      throw new ProjectInvitationNotPendingError();
    }

    const claimRecord = await this.repository.findInvitationClaimByToken(invitation.claimToken);
    if (!claimRecord) {
      throw new ProjectInvitationNotFoundError();
    }

    const delivery = await this.invitationDelivery.deliverInvitation({
      invitation: claimRecord,
      trigger: 'redelivered'
    });

    return {
      invitation,
      delivery
    };
  }

  async acceptProjectInvitationClaim(input: {
    claimToken: string;
    actorUserId: string;
  }): Promise<ProjectInvitationClaimRecord> {
    const invitation = await this.repository.findInvitationClaimByToken(input.claimToken);
    if (!invitation) {
      throw new ProjectInvitationNotFoundError();
    }

    if (invitation.status === 'accepted') {
      if (invitation.acceptedBy === input.actorUserId) {
        return invitation;
      }

      throw new ProjectInvitationNotPendingError();
    }

    if (invitation.status !== 'pending') {
      throw new ProjectInvitationNotPendingError();
    }

    const user = await this.repository.findPersistedUserById(input.actorUserId);
    if (!user) {
      throw new UserProfileRequiredError();
    }

    if (normalizeEmailAddress(user.email) !== normalizeEmailAddress(invitation.email)) {
      throw new ProjectInvitationEmailMismatchError();
    }

    const existingMembership = await this.repository.findMembership(
      invitation.projectId,
      input.actorUserId
    );
    if (!existingMembership) {
      await this.repository.addMember({
        projectId: invitation.projectId,
        userId: input.actorUserId,
        role: invitation.role,
        invitedBy: invitation.invitedBy ?? input.actorUserId
      });
    }

    const acceptedRecord = await this.repository.acceptInvitation(invitation.id, input.actorUserId);
    if (!acceptedRecord) {
      throw new ProjectInvitationNotPendingError();
    }

    const acceptedInvitation = await this.repository.findInvitationClaimByToken(input.claimToken);
    if (!acceptedInvitation) {
      throw new ProjectInvitationNotFoundError();
    }

    return acceptedInvitation;
  }

  async updateProjectMemberRole(input: {
    projectId: string;
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (project.userId === input.userId) {
      throw new ProjectOwnerMembershipImmutableError();
    }

    const existingMembership = await this.repository.findMemberDetails(input.projectId, input.userId);
    if (!existingMembership) {
      throw new ProjectMemberNotFoundError();
    }

    if (existingMembership.role === input.role) {
      return existingMembership;
    }

    await this.repository.updateMemberRole(input);

    const updatedMembership = await this.repository.findMemberDetails(input.projectId, input.userId);
    if (!updatedMembership) {
      throw new ProjectMemberNotFoundError();
    }

    return updatedMembership;
  }

  async removeProjectMember(input: {
    projectId: string;
    userId: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (project.userId === input.userId) {
      throw new ProjectOwnerMembershipImmutableError();
    }

    const existingMembership = await this.repository.findMemberDetails(input.projectId, input.userId);
    if (!existingMembership) {
      throw new ProjectMemberNotFoundError();
    }

    await this.repository.removeMember(input.projectId, input.userId);
  }

  async transferProjectOwnership(input: {
    projectId: string;
    userId: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (project.userId !== input.userId) {
      const existingMembership = await this.repository.findMemberDetails(input.projectId, input.userId);
      if (!existingMembership) {
        throw new ProjectMemberNotFoundError();
      }

      const updatedProject = await this.repository.transferOwnership({
        projectId: input.projectId,
        previousOwnerUserId: project.userId,
        nextOwnerUserId: input.userId
      });

      if (!updatedProject) {
        throw new ProjectNotFoundError();
      }
    }

    const updatedMembers = await this.repository.listMembers(input.projectId);
    const nextOwner = updatedMembers.find((member) => member.userId === input.userId);
    if (!nextOwner) {
      throw new ProjectMemberNotFoundError();
    }

    return nextOwner;
  }

  async inviteProjectMember(input: {
    projectId: string;
    email: string;
    role: 'viewer' | 'editor' | 'admin';
    invitedBy: string;
  }): Promise<ProjectInviteResult> {
    const normalizedEmail = normalizeEmailAddress(input.email);
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const user = await this.repository.findPersistedUserByEmail(normalizedEmail);
    if (user) {
      if (project.userId === user.id) {
        throw new ProjectMemberAlreadyExistsError();
      }

      const existingMembership = await this.repository.findMembership(input.projectId, user.id);
      if (existingMembership) {
        throw new ProjectMemberAlreadyExistsError();
      }

      try {
        const membership = await this.repository.addMember({
          projectId: input.projectId,
          userId: user.id,
          role: input.role,
          invitedBy: input.invitedBy
        });

        const activeInvitation = await this.repository.findActiveInvitationByEmail(
          input.projectId,
          normalizedEmail
        );
        if (activeInvitation) {
          await this.repository.acceptInvitation(activeInvitation.id, user.id);
        }

        return {
          kind: 'member',
          member: {
            ...membership,
            isOwner: false,
            user
          }
        };
      } catch (error) {
        const pgError = error as PostgresError;
        if (pgError.code === '23505' && pgError.constraint === 'project_members_project_user_unique') {
          throw new ProjectMemberAlreadyExistsError();
        }

        throw error;
      }
    }

    try {
      const existingInvitation = await this.repository.findActiveInvitationByEmail(
        input.projectId,
        normalizedEmail
      );
      if (existingInvitation) {
        throw new ProjectInvitationAlreadyExistsError();
      }

      const invitation = await this.repository.addInvitation({
        projectId: input.projectId,
        email: normalizedEmail,
        claimToken: createInvitationClaimToken(),
        role: input.role,
        invitedBy: input.invitedBy
      });

      const invitationClaimRecord = await this.repository.findInvitationClaimByToken(invitation.claimToken);
      if (!invitationClaimRecord) {
        throw new ProjectInvitationNotFoundError();
      }

      const delivery = await this.invitationDelivery.deliverInvitation({
        invitation: invitationClaimRecord,
        trigger: 'created'
      });

      return {
        kind: 'invitation',
        invitation: {
          id: invitation.id,
          projectId: invitation.projectId,
          email: invitation.email,
          claimToken: invitation.claimToken,
          role: invitation.role,
          status: 'pending',
          invitedBy: invitation.invitedBy,
          acceptedBy: null,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          acceptedAt: null,
          cancelledAt: null,
          invitedByUser: null,
          acceptedByUser: null
        },
        delivery
      };
    } catch (error) {
      const pgError = error as PostgresError;
      if (error instanceof ProjectInvitationAlreadyExistsError) {
        throw error;
      }

      if (pgError.code === '23505' && pgError.constraint === 'project_invitations_project_email_pending_unique') {
        throw new ProjectInvitationAlreadyExistsError();
      }

      throw error;
    }
  }
}
