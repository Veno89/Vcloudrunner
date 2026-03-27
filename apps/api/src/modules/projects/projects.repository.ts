import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ProjectServiceDefinition } from '@vcloudrunner/shared-types';

import type { DbClient } from '../../db/client.js';
import { projectInvitations, projectMembers, projects, users } from '../../db/schema.js';

export interface CreateProjectInput {
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch?: string;
  services?: ProjectServiceDefinition[];
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  invitedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ProjectInvitationRecord {
  id: string;
  projectId: string;
  email: string;
  claimToken: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'accepted' | 'cancelled';
  invitedBy: string | null;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  invitedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  acceptedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ProjectInvitationClaimRecord extends ProjectInvitationRecord {
  projectName: string;
  projectSlug: string;
}

const invitedByUsers = alias(users, 'project_invitation_invited_by_users');
const acceptedByUsers = alias(users, 'project_invitation_accepted_by_users');

function toRelatedUser(input: {
  id: string | null;
  name: string | null;
  email: string | null;
}) {
  return input.id
    ? {
        id: input.id,
        name: input.name ?? 'Unknown user',
        email: input.email ?? 'unknown@example.com'
      }
    : null;
}

export class ProjectsRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateProjectInput) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx.insert(projects).values({
        userId: input.userId,
        name: input.name,
        slug: input.slug,
        gitRepositoryUrl: input.gitRepositoryUrl,
        defaultBranch: input.defaultBranch ?? 'main',
        ...(input.services ? { services: input.services } : {})
      }).returning();

      await tx.insert(projectMembers).values({
        projectId: record.id,
        userId: input.userId,
        role: 'admin'
      });

      return record;
    });
  }

  async findAllByUser(userId: string) {
    return this.db
      .selectDistinct({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        slug: projects.slug,
        gitRepositoryUrl: projects.gitRepositoryUrl,
        defaultBranch: projects.defaultBranch,
        services: projects.services,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt
      })
      .from(projects)
      .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .where(or(
        eq(projects.userId, userId),
        eq(projectMembers.userId, userId)
      ))
      .orderBy(desc(projects.createdAt));
  }

  async findById(id: string) {
    return this.db.query.projects.findFirst({
      where: eq(projects.id, id)
    });
  }

  async checkMembership(projectId: string, userId: string) {
    const membership = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ))
      .limit(1);

    return membership.length > 0;
  }

  async findMembership(projectId: string, userId: string) {
    const membership = await this.db
      .select({
        id: projectMembers.id,
        role: projectMembers.role
      })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ))
      .limit(1);

    return membership[0] ?? null;
  }

  async findMemberDetails(projectId: string, userId: string): Promise<ProjectMemberRecord | null> {
    const member = await this.db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        role: projectMembers.role,
        invitedBy: projectMembers.invitedBy,
        createdAt: projectMembers.createdAt,
        updatedAt: projectMembers.updatedAt,
        projectOwnerUserId: projects.userId,
        name: users.name,
        email: users.email
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ))
      .limit(1);

    const record = member[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      role: record.role,
      invitedBy: record.invitedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isOwner: record.userId === record.projectOwnerUserId,
      user: {
        id: record.userId,
        name: record.name,
        email: record.email
      }
    };
  }

  async listMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    const ownerResult = await this.db
      .select({
        projectId: projects.id,
        projectCreatedAt: projects.createdAt,
        ownerUserId: users.id,
        ownerName: users.name,
        ownerEmail: users.email
      })
      .from(projects)
      .innerJoin(users, eq(users.id, projects.userId))
      .where(eq(projects.id, projectId))
      .limit(1);

    const owner = ownerResult[0];
    if (!owner) {
      return [];
    }

    const memberships = await this.db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        role: projectMembers.role,
        invitedBy: projectMembers.invitedBy,
        createdAt: projectMembers.createdAt,
        updatedAt: projectMembers.updatedAt,
        name: users.name,
        email: users.email
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt));

    const members = memberships.map((membership) => ({
      id: membership.id,
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      invitedBy: membership.invitedBy,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      isOwner: membership.userId === owner.ownerUserId,
      user: {
        id: membership.userId,
        name: membership.name,
        email: membership.email
      }
    })) satisfies ProjectMemberRecord[];

    if (members.some((member) => member.userId === owner.ownerUserId)) {
      return members;
    }

    return [{
      id: owner.ownerUserId,
      projectId: owner.projectId,
      userId: owner.ownerUserId,
      role: 'admin',
      invitedBy: null,
      createdAt: owner.projectCreatedAt,
      updatedAt: owner.projectCreatedAt,
      isOwner: true,
      user: {
        id: owner.ownerUserId,
        name: owner.ownerName,
        email: owner.ownerEmail
      }
    }, ...members];
  }

  async listInvitations(projectId: string): Promise<ProjectInvitationRecord[]> {
    const invitations = await this.db
      .select({
        id: projectInvitations.id,
        projectId: projectInvitations.projectId,
        email: projectInvitations.email,
        claimToken: projectInvitations.claimToken,
        role: projectInvitations.role,
        status: projectInvitations.status,
        invitedBy: projectInvitations.invitedBy,
        acceptedBy: projectInvitations.acceptedByUserId,
        createdAt: projectInvitations.createdAt,
        updatedAt: projectInvitations.updatedAt,
        acceptedAt: projectInvitations.acceptedAt,
        cancelledAt: projectInvitations.cancelledAt,
        invitedByUserId: invitedByUsers.id,
        invitedByUserName: invitedByUsers.name,
        invitedByUserEmail: invitedByUsers.email,
        acceptedByUserId: acceptedByUsers.id,
        acceptedByUserName: acceptedByUsers.name,
        acceptedByUserEmail: acceptedByUsers.email
      })
      .from(projectInvitations)
      .leftJoin(invitedByUsers, eq(invitedByUsers.id, projectInvitations.invitedBy))
      .leftJoin(acceptedByUsers, eq(acceptedByUsers.id, projectInvitations.acceptedByUserId))
      .where(eq(projectInvitations.projectId, projectId))
      .orderBy(
        sql<number>`case when ${projectInvitations.status} = 'pending' then 0 else 1 end`,
        desc(projectInvitations.updatedAt),
        asc(projectInvitations.createdAt)
      );

    return invitations.map((invitation) => ({
      id: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      claimToken: invitation.claimToken,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      acceptedBy: invitation.acceptedBy,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      invitedByUser: toRelatedUser({
        id: invitation.invitedByUserId,
        name: invitation.invitedByUserName,
        email: invitation.invitedByUserEmail
      }),
      acceptedByUser: toRelatedUser({
        id: invitation.acceptedByUserId,
        name: invitation.acceptedByUserName,
        email: invitation.acceptedByUserEmail
      })
    })) satisfies ProjectInvitationRecord[];
  }

  async findPersistedUserByEmail(email: string) {
    const user = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user[0] ?? null;
  }

  async findPersistedUserById(userId: string) {
    const user = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user[0] ?? null;
  }

  async findActiveInvitationByEmail(projectId: string, email: string) {
    const invitation = await this.db
      .select({
        id: projectInvitations.id
      })
      .from(projectInvitations)
      .where(and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.email, email),
        eq(projectInvitations.status, 'pending')
      ))
      .limit(1);

    return invitation[0] ?? null;
  }

  async findInvitationDetails(projectId: string, invitationId: string): Promise<ProjectInvitationRecord | null> {
    const invitation = await this.db
      .select({
        id: projectInvitations.id,
        projectId: projectInvitations.projectId,
        email: projectInvitations.email,
        claimToken: projectInvitations.claimToken,
        role: projectInvitations.role,
        status: projectInvitations.status,
        invitedBy: projectInvitations.invitedBy,
        acceptedBy: projectInvitations.acceptedByUserId,
        createdAt: projectInvitations.createdAt,
        updatedAt: projectInvitations.updatedAt,
        acceptedAt: projectInvitations.acceptedAt,
        cancelledAt: projectInvitations.cancelledAt,
        invitedByUserId: invitedByUsers.id,
        invitedByUserName: invitedByUsers.name,
        invitedByUserEmail: invitedByUsers.email,
        acceptedByUserId: acceptedByUsers.id,
        acceptedByUserName: acceptedByUsers.name,
        acceptedByUserEmail: acceptedByUsers.email
      })
      .from(projectInvitations)
      .leftJoin(invitedByUsers, eq(invitedByUsers.id, projectInvitations.invitedBy))
      .leftJoin(acceptedByUsers, eq(acceptedByUsers.id, projectInvitations.acceptedByUserId))
      .where(and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.id, invitationId)
      ))
      .limit(1);

    const record = invitation[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      projectId: record.projectId,
      email: record.email,
      claimToken: record.claimToken,
      role: record.role,
      status: record.status,
      invitedBy: record.invitedBy,
      acceptedBy: record.acceptedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      acceptedAt: record.acceptedAt,
      cancelledAt: record.cancelledAt,
      invitedByUser: toRelatedUser({
        id: record.invitedByUserId,
        name: record.invitedByUserName,
        email: record.invitedByUserEmail
      }),
      acceptedByUser: toRelatedUser({
        id: record.acceptedByUserId,
        name: record.acceptedByUserName,
        email: record.acceptedByUserEmail
      })
    };
  }

  async findInvitationClaimByToken(claimToken: string): Promise<ProjectInvitationClaimRecord | null> {
    const invitation = await this.db
      .select({
        id: projectInvitations.id,
        projectId: projectInvitations.projectId,
        projectName: projects.name,
        projectSlug: projects.slug,
        email: projectInvitations.email,
        claimToken: projectInvitations.claimToken,
        role: projectInvitations.role,
        status: projectInvitations.status,
        invitedBy: projectInvitations.invitedBy,
        acceptedBy: projectInvitations.acceptedByUserId,
        createdAt: projectInvitations.createdAt,
        updatedAt: projectInvitations.updatedAt,
        acceptedAt: projectInvitations.acceptedAt,
        cancelledAt: projectInvitations.cancelledAt,
        invitedByUserId: invitedByUsers.id,
        invitedByUserName: invitedByUsers.name,
        invitedByUserEmail: invitedByUsers.email,
        acceptedByUserId: acceptedByUsers.id,
        acceptedByUserName: acceptedByUsers.name,
        acceptedByUserEmail: acceptedByUsers.email
      })
      .from(projectInvitations)
      .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
      .leftJoin(invitedByUsers, eq(invitedByUsers.id, projectInvitations.invitedBy))
      .leftJoin(acceptedByUsers, eq(acceptedByUsers.id, projectInvitations.acceptedByUserId))
      .where(eq(projectInvitations.claimToken, claimToken))
      .limit(1);

    const record = invitation[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      projectId: record.projectId,
      projectName: record.projectName,
      projectSlug: record.projectSlug,
      email: record.email,
      claimToken: record.claimToken,
      role: record.role,
      status: record.status,
      invitedBy: record.invitedBy,
      acceptedBy: record.acceptedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      acceptedAt: record.acceptedAt,
      cancelledAt: record.cancelledAt,
      invitedByUser: toRelatedUser({
        id: record.invitedByUserId,
        name: record.invitedByUserName,
        email: record.invitedByUserEmail
      }),
      acceptedByUser: toRelatedUser({
        id: record.acceptedByUserId,
        name: record.acceptedByUserName,
        email: record.acceptedByUserEmail
      })
    };
  }

  async addMember(input: {
    projectId: string;
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
    invitedBy: string;
  }) {
    const [record] = await this.db.insert(projectMembers).values({
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy
    }).returning();

    return record;
  }

  async addInvitation(input: {
    projectId: string;
    email: string;
    claimToken: string;
    role: 'viewer' | 'editor' | 'admin';
    invitedBy: string;
  }) {
    const [record] = await this.db.insert(projectInvitations).values({
      projectId: input.projectId,
      email: input.email,
      claimToken: input.claimToken,
      role: input.role,
      status: 'pending',
      invitedBy: input.invitedBy
    }).returning();

    return record;
  }

  async updateInvitation(input: {
    projectId: string;
    invitationId: string;
    role: 'viewer' | 'editor' | 'admin';
    invitedBy: string;
  }) {
    const [record] = await this.db
      .update(projectInvitations)
      .set({
        role: input.role,
        invitedBy: input.invitedBy,
        updatedAt: new Date()
      })
      .where(and(
        eq(projectInvitations.projectId, input.projectId),
        eq(projectInvitations.id, input.invitationId),
        eq(projectInvitations.status, 'pending')
      ))
      .returning({
        id: projectInvitations.id
      });

    return record ?? null;
  }

  async cancelInvitation(projectId: string, invitationId: string) {
    const [record] = await this.db
      .update(projectInvitations)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(projectInvitations.projectId, projectId),
        eq(projectInvitations.id, invitationId),
        eq(projectInvitations.status, 'pending')
      ))
      .returning({
        id: projectInvitations.id
      });

    return record ?? null;
  }

  async acceptInvitation(invitationId: string, acceptedByUserId: string) {
    const [record] = await this.db
      .update(projectInvitations)
      .set({
        status: 'accepted',
        acceptedByUserId,
        acceptedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(projectInvitations.id, invitationId),
        eq(projectInvitations.status, 'pending')
      ))
      .returning({
        id: projectInvitations.id
      });

    return record ?? null;
  }

  async updateMemberRole(input: {
    projectId: string;
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
  }) {
    const [record] = await this.db
      .update(projectMembers)
      .set({
        role: input.role,
        updatedAt: new Date()
      })
      .where(and(
        eq(projectMembers.projectId, input.projectId),
        eq(projectMembers.userId, input.userId)
      ))
      .returning();

    return record ?? null;
  }

  async removeMember(projectId: string, userId: string) {
    const [record] = await this.db
      .delete(projectMembers)
      .where(and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      ))
      .returning({
        id: projectMembers.id
      });

    return record ?? null;
  }

  async transferOwnership(input: {
    projectId: string;
    previousOwnerUserId: string;
    nextOwnerUserId: string;
  }) {
    return this.db.transaction(async (tx) => {
      const timestamp = new Date();

      const previousOwnerMembership = await tx
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, input.previousOwnerUserId)
        ))
        .limit(1);

      if (previousOwnerMembership[0]) {
        await tx
          .update(projectMembers)
          .set({
            role: 'admin',
            updatedAt: timestamp
          })
          .where(and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.previousOwnerUserId)
          ));
      } else {
        await tx.insert(projectMembers).values({
          projectId: input.projectId,
          userId: input.previousOwnerUserId,
          role: 'admin',
          invitedBy: null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }

      await tx
        .update(projectMembers)
        .set({
          role: 'admin',
          updatedAt: timestamp
        })
        .where(and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, input.nextOwnerUserId)
        ));

      const [record] = await tx
        .update(projects)
        .set({
          userId: input.nextOwnerUserId,
          updatedAt: timestamp
        })
        .where(eq(projects.id, input.projectId))
        .returning({
          id: projects.id
        });

      return record ?? null;
    });
  }
}
