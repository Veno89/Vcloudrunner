import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  ProjectServiceDefinition,
  ProjectServiceExposure,
  ProjectServiceKind
} from '@vcloudrunner/shared-types';
import type {
  ProjectDomainCertificateChainEntry,
  ProjectDomainCertificateValidationReason,
  ProjectDomainVerificationStatus,
  ProjectDomainOwnershipStatus,
  ProjectDomainTlsStatus
} from '../../services/project-domain-diagnostics.service.js';

import type { DbClient } from '../../db/client.js';
import {
  containers,
  deploymentLogs,
  deployments,
  domains,
  environmentVariables,
  projectDomainEvents,
  projectInvitations,
  projectMembers,
  projects,
  users
} from '../../db/schema.js';

export type ProjectDomainEventKind =
  | 'ownership'
  | 'tls'
  | 'certificate'
  | 'certificate_trust'
  | 'certificate_path_validity'
  | 'certificate_identity'
  | 'certificate_attention'
  | 'certificate_chain';

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

export interface ProjectDomainRecord {
  id: string;
  projectId: string;
  deploymentId: string | null;
  host: string;
  targetPort: number;
  verificationToken: string | null;
  verificationStatus: ProjectDomainVerificationStatus | null;
  verificationDetail: string | null;
  verificationCheckedAt: Date | null;
  verificationStatusChangedAt: Date | null;
  verificationVerifiedAt: Date | null;
  ownershipStatus: ProjectDomainOwnershipStatus | null;
  ownershipDetail: string | null;
  tlsStatus: ProjectDomainTlsStatus | null;
  tlsDetail: string | null;
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
  certificateChainSubjects: string[];
  certificateChainEntries: ProjectDomainCertificateChainEntry[];
  certificateRootSubjectName: string | null;
  certificateChainChangedAt: Date | null;
  certificateChainObservedCount: number;
  certificateChainLastHealthyAt: Date | null;
  certificateLastHealthyChainEntries: ProjectDomainCertificateChainEntry[];
  certificatePathValidityChangedAt: Date | null;
  certificatePathValidityObservedCount: number;
  certificatePathValidityLastHealthyAt: Date | null;
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  diagnosticsCheckedAt: Date | null;
  ownershipStatusChangedAt: Date | null;
  tlsStatusChangedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  tlsReadyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deploymentStatus: 'queued' | 'building' | 'running' | 'failed' | 'stopped' | null;
  runtimeUrl: string | null;
  serviceName: string | null;
  serviceKind: ProjectServiceKind | null;
  serviceExposure: ProjectServiceExposure | null;
}

export interface ProjectDomainEventRecord {
  id: string;
  projectId: string;
  domainId: string;
  kind: ProjectDomainEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface ProjectActiveDeploymentRecord {
  id: string;
  projectId: string;
  serviceName: string;
  status: 'queued' | 'building' | 'running';
}

export interface CreateProjectDomainInput {
  projectId: string;
  host: string;
  targetPort: number;
  verificationToken: string | null;
}

export interface CreateProjectDomainEventInput {
  projectId: string;
  domainId: string;
  kind: ProjectDomainEventKind;
  previousStatus: string | null;
  nextStatus: string;
  detail: string;
  createdAt: Date;
}

export interface UpdateProjectDomainDiagnosticsInput {
  projectId: string;
  domainId: string;
  verificationStatus: ProjectDomainVerificationStatus;
  verificationDetail: string;
  verificationCheckedAt: Date;
  verificationStatusChangedAt: Date | null;
  verificationVerifiedAt: Date | null;
  ownershipStatus: ProjectDomainOwnershipStatus;
  ownershipDetail: string;
  tlsStatus: ProjectDomainTlsStatus;
  tlsDetail: string;
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
  certificateChainSubjects: string[];
  certificateChainEntries: ProjectDomainCertificateChainEntry[];
  certificateRootSubjectName: string | null;
  certificateChainChangedAt: Date | null;
  certificateChainObservedCount: number;
  certificateChainLastHealthyAt: Date | null;
  certificateLastHealthyChainEntries: ProjectDomainCertificateChainEntry[];
  certificatePathValidityChangedAt: Date | null;
  certificatePathValidityObservedCount: number;
  certificatePathValidityLastHealthyAt: Date | null;
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  diagnosticsCheckedAt: Date;
  ownershipStatusChangedAt: Date | null;
  tlsStatusChangedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  tlsReadyAt: Date | null;
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

function toDeploymentServiceMetadata(input: {
  serviceName: string | null;
  metadata: unknown;
}) {
  if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
    return {
      serviceName: input.serviceName,
      serviceKind: null,
      serviceExposure: null
    } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
  }

  const service = (input.metadata as { service?: unknown }).service;
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    return {
      serviceName: input.serviceName,
      serviceKind: null,
      serviceExposure: null
    } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
  }

  const serviceName = typeof (service as { name?: unknown }).name === 'string'
    ? (service as { name: string }).name
    : input.serviceName;
  const kind = (service as { kind?: unknown }).kind;
  const exposure = (service as { exposure?: unknown }).exposure;

  return {
    serviceName,
    serviceKind: kind === 'web' || kind === 'worker' ? kind : null,
    serviceExposure: exposure === 'public' || exposure === 'internal' ? exposure : null
  } satisfies Pick<ProjectDomainRecord, 'serviceName' | 'serviceKind' | 'serviceExposure'>;
}

function toCertificateValidationReason(
  value: string | null
): ProjectDomainCertificateValidationReason | null {
  switch (value) {
    case 'self-signed':
    case 'hostname-mismatch':
    case 'issuer-untrusted':
    case 'expired':
    case 'not-yet-valid':
    case 'validation-failed':
      return value;
    default:
      return null;
  }
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

  async listActiveDeployments(projectId: string): Promise<ProjectActiveDeploymentRecord[]> {
    return this.db
      .select({
        id: deployments.id,
        projectId: deployments.projectId,
        serviceName: deployments.serviceName,
        status: deployments.status
      })
      .from(deployments)
      .where(and(
        eq(deployments.projectId, projectId),
        inArray(deployments.status, ['queued', 'building', 'running'])
      ))
      .orderBy(asc(deployments.createdAt)) as Promise<ProjectActiveDeploymentRecord[]>;
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

  async listDomains(projectId: string): Promise<ProjectDomainRecord[]> {
    const records = await this.db
      .select({
        id: domains.id,
        projectId: domains.projectId,
        deploymentId: domains.deploymentId,
        host: domains.host,
        targetPort: domains.targetPort,
        verificationToken: domains.verificationToken,
        verificationStatus: domains.verificationStatus,
        verificationDetail: domains.verificationDetail,
        verificationCheckedAt: domains.verificationCheckedAt,
        verificationStatusChangedAt: domains.verificationStatusChangedAt,
        verificationVerifiedAt: domains.verificationVerifiedAt,
        ownershipStatus: domains.ownershipStatus,
        ownershipDetail: domains.ownershipDetail,
        tlsStatus: domains.tlsStatus,
        tlsDetail: domains.tlsDetail,
        certificateValidFrom: domains.certificateValidFrom,
        certificateValidTo: domains.certificateValidTo,
        certificateSubjectName: domains.certificateSubjectName,
        certificateIssuerName: domains.certificateIssuerName,
        certificateSubjectAltNames: domains.certificateSubjectAltNames,
        certificateChainSubjects: domains.certificateChainSubjects,
        certificateChainEntries: domains.certificateChainEntries,
        certificateRootSubjectName: domains.certificateRootSubjectName,
        certificateChainChangedAt: domains.certificateChainChangedAt,
        certificateChainObservedCount: domains.certificateChainObservedCount,
        certificateChainLastHealthyAt: domains.certificateChainLastHealthyAt,
        certificateLastHealthyChainEntries: domains.certificateLastHealthyChainEntries,
        certificatePathValidityChangedAt: domains.certificatePathValidityChangedAt,
        certificatePathValidityObservedCount: domains.certificatePathValidityObservedCount,
        certificatePathValidityLastHealthyAt: domains.certificatePathValidityLastHealthyAt,
        certificateValidationReason: domains.certificateValidationReason,
        certificateFingerprintSha256: domains.certificateFingerprintSha256,
        certificateSerialNumber: domains.certificateSerialNumber,
        certificateFirstObservedAt: domains.certificateFirstObservedAt,
        certificateChangedAt: domains.certificateChangedAt,
        certificateLastRotatedAt: domains.certificateLastRotatedAt,
        certificateGuidanceChangedAt: domains.certificateGuidanceChangedAt,
        certificateGuidanceObservedCount: domains.certificateGuidanceObservedCount,
        diagnosticsCheckedAt: domains.diagnosticsCheckedAt,
        ownershipStatusChangedAt: domains.ownershipStatusChangedAt,
        tlsStatusChangedAt: domains.tlsStatusChangedAt,
        ownershipVerifiedAt: domains.ownershipVerifiedAt,
        tlsReadyAt: domains.tlsReadyAt,
        createdAt: domains.createdAt,
        updatedAt: domains.updatedAt,
        deploymentStatus: deployments.status,
        runtimeUrl: deployments.runtimeUrl,
        serviceName: deployments.serviceName,
        deploymentMetadata: deployments.metadata
      })
      .from(domains)
      .leftJoin(deployments, eq(deployments.id, domains.deploymentId))
      .where(eq(domains.projectId, projectId))
      .orderBy(asc(domains.host), desc(domains.updatedAt));

    return records.map((record) => ({
      id: record.id,
      projectId: record.projectId,
      deploymentId: record.deploymentId,
      host: record.host,
      targetPort: record.targetPort,
      verificationToken: record.verificationToken,
      verificationStatus: record.verificationStatus,
      verificationDetail: record.verificationDetail,
      verificationCheckedAt: record.verificationCheckedAt,
      verificationStatusChangedAt: record.verificationStatusChangedAt,
      verificationVerifiedAt: record.verificationVerifiedAt,
      ownershipStatus: record.ownershipStatus,
      ownershipDetail: record.ownershipDetail,
      tlsStatus: record.tlsStatus,
      tlsDetail: record.tlsDetail,
      certificateValidFrom: record.certificateValidFrom,
      certificateValidTo: record.certificateValidTo,
      certificateSubjectName: record.certificateSubjectName,
      certificateIssuerName: record.certificateIssuerName,
      certificateSubjectAltNames: record.certificateSubjectAltNames,
      certificateChainSubjects: record.certificateChainSubjects,
      certificateChainEntries: record.certificateChainEntries,
      certificateRootSubjectName: record.certificateRootSubjectName,
      certificateChainChangedAt: record.certificateChainChangedAt,
      certificateChainObservedCount: record.certificateChainObservedCount,
      certificateChainLastHealthyAt: record.certificateChainLastHealthyAt,
      certificateLastHealthyChainEntries: record.certificateLastHealthyChainEntries,
      certificatePathValidityChangedAt: record.certificatePathValidityChangedAt,
      certificatePathValidityObservedCount: record.certificatePathValidityObservedCount,
      certificatePathValidityLastHealthyAt: record.certificatePathValidityLastHealthyAt,
      certificateValidationReason: toCertificateValidationReason(record.certificateValidationReason),
      certificateFingerprintSha256: record.certificateFingerprintSha256,
      certificateSerialNumber: record.certificateSerialNumber,
      certificateFirstObservedAt: record.certificateFirstObservedAt,
      certificateChangedAt: record.certificateChangedAt,
      certificateLastRotatedAt: record.certificateLastRotatedAt,
      certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
      certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
      diagnosticsCheckedAt: record.diagnosticsCheckedAt,
      ownershipStatusChangedAt: record.ownershipStatusChangedAt,
      tlsStatusChangedAt: record.tlsStatusChangedAt,
      ownershipVerifiedAt: record.ownershipVerifiedAt,
      tlsReadyAt: record.tlsReadyAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deploymentStatus: record.deploymentStatus,
      runtimeUrl: record.runtimeUrl,
      ...toDeploymentServiceMetadata({
        serviceName: record.serviceName,
        metadata: record.deploymentMetadata
      })
    })) satisfies ProjectDomainRecord[];
  }

  async createDomain(input: CreateProjectDomainInput): Promise<ProjectDomainRecord> {
    const [record] = await this.db
      .insert(domains)
      .values({
        projectId: input.projectId,
        host: input.host,
        targetPort: input.targetPort,
        verificationToken: input.verificationToken,
        deploymentId: null
      })
      .returning();

    return {
      id: record.id,
      projectId: record.projectId,
      deploymentId: record.deploymentId,
      host: record.host,
      targetPort: record.targetPort,
      verificationToken: record.verificationToken,
      verificationStatus: record.verificationStatus,
      verificationDetail: record.verificationDetail,
      verificationCheckedAt: record.verificationCheckedAt,
      verificationStatusChangedAt: record.verificationStatusChangedAt,
      verificationVerifiedAt: record.verificationVerifiedAt,
      ownershipStatus: record.ownershipStatus,
      ownershipDetail: record.ownershipDetail,
      tlsStatus: record.tlsStatus,
      tlsDetail: record.tlsDetail,
      certificateValidFrom: record.certificateValidFrom,
      certificateValidTo: record.certificateValidTo,
      certificateSubjectName: record.certificateSubjectName,
      certificateIssuerName: record.certificateIssuerName,
      certificateSubjectAltNames: record.certificateSubjectAltNames,
      certificateChainSubjects: record.certificateChainSubjects,
      certificateChainEntries: record.certificateChainEntries,
      certificateRootSubjectName: record.certificateRootSubjectName,
      certificateChainChangedAt: record.certificateChainChangedAt,
      certificateChainObservedCount: record.certificateChainObservedCount,
      certificateChainLastHealthyAt: record.certificateChainLastHealthyAt,
      certificateLastHealthyChainEntries: record.certificateLastHealthyChainEntries,
      certificatePathValidityChangedAt: record.certificatePathValidityChangedAt,
      certificatePathValidityObservedCount: record.certificatePathValidityObservedCount,
      certificatePathValidityLastHealthyAt: record.certificatePathValidityLastHealthyAt,
      certificateValidationReason: toCertificateValidationReason(record.certificateValidationReason),
      certificateFingerprintSha256: record.certificateFingerprintSha256,
      certificateSerialNumber: record.certificateSerialNumber,
      certificateFirstObservedAt: record.certificateFirstObservedAt,
      certificateChangedAt: record.certificateChangedAt,
      certificateLastRotatedAt: record.certificateLastRotatedAt,
      certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
      certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
      diagnosticsCheckedAt: record.diagnosticsCheckedAt,
      ownershipStatusChangedAt: record.ownershipStatusChangedAt,
      tlsStatusChangedAt: record.tlsStatusChangedAt,
      ownershipVerifiedAt: record.ownershipVerifiedAt,
      tlsReadyAt: record.tlsReadyAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deploymentStatus: null,
      runtimeUrl: null,
      serviceName: null,
      serviceKind: null,
      serviceExposure: null
    } satisfies ProjectDomainRecord;
  }

  async findDomainById(projectId: string, domainId: string): Promise<ProjectDomainRecord | null> {
    const records = await this.db
      .select({
        id: domains.id,
        projectId: domains.projectId,
        deploymentId: domains.deploymentId,
        host: domains.host,
        targetPort: domains.targetPort,
        verificationToken: domains.verificationToken,
        verificationStatus: domains.verificationStatus,
        verificationDetail: domains.verificationDetail,
        verificationCheckedAt: domains.verificationCheckedAt,
        verificationStatusChangedAt: domains.verificationStatusChangedAt,
        verificationVerifiedAt: domains.verificationVerifiedAt,
        ownershipStatus: domains.ownershipStatus,
        ownershipDetail: domains.ownershipDetail,
        tlsStatus: domains.tlsStatus,
        tlsDetail: domains.tlsDetail,
        certificateValidFrom: domains.certificateValidFrom,
        certificateValidTo: domains.certificateValidTo,
        certificateSubjectName: domains.certificateSubjectName,
        certificateIssuerName: domains.certificateIssuerName,
        certificateSubjectAltNames: domains.certificateSubjectAltNames,
        certificateChainSubjects: domains.certificateChainSubjects,
        certificateChainEntries: domains.certificateChainEntries,
        certificateRootSubjectName: domains.certificateRootSubjectName,
        certificateChainChangedAt: domains.certificateChainChangedAt,
        certificateChainObservedCount: domains.certificateChainObservedCount,
        certificateChainLastHealthyAt: domains.certificateChainLastHealthyAt,
        certificateLastHealthyChainEntries: domains.certificateLastHealthyChainEntries,
        certificatePathValidityChangedAt: domains.certificatePathValidityChangedAt,
        certificatePathValidityObservedCount: domains.certificatePathValidityObservedCount,
        certificatePathValidityLastHealthyAt: domains.certificatePathValidityLastHealthyAt,
        certificateValidationReason: domains.certificateValidationReason,
        certificateFingerprintSha256: domains.certificateFingerprintSha256,
        certificateSerialNumber: domains.certificateSerialNumber,
        certificateFirstObservedAt: domains.certificateFirstObservedAt,
        certificateChangedAt: domains.certificateChangedAt,
        certificateLastRotatedAt: domains.certificateLastRotatedAt,
        certificateGuidanceChangedAt: domains.certificateGuidanceChangedAt,
        certificateGuidanceObservedCount: domains.certificateGuidanceObservedCount,
        diagnosticsCheckedAt: domains.diagnosticsCheckedAt,
        ownershipStatusChangedAt: domains.ownershipStatusChangedAt,
        tlsStatusChangedAt: domains.tlsStatusChangedAt,
        ownershipVerifiedAt: domains.ownershipVerifiedAt,
        tlsReadyAt: domains.tlsReadyAt,
        createdAt: domains.createdAt,
        updatedAt: domains.updatedAt,
        deploymentStatus: deployments.status,
        runtimeUrl: deployments.runtimeUrl,
        serviceName: deployments.serviceName,
        deploymentMetadata: deployments.metadata
      })
      .from(domains)
      .leftJoin(deployments, eq(deployments.id, domains.deploymentId))
      .where(and(
        eq(domains.projectId, projectId),
        eq(domains.id, domainId)
      ))
      .limit(1);

    const record = records[0];
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      projectId: record.projectId,
      deploymentId: record.deploymentId,
      host: record.host,
      targetPort: record.targetPort,
      verificationToken: record.verificationToken,
      verificationStatus: record.verificationStatus,
      verificationDetail: record.verificationDetail,
      verificationCheckedAt: record.verificationCheckedAt,
      verificationStatusChangedAt: record.verificationStatusChangedAt,
      verificationVerifiedAt: record.verificationVerifiedAt,
      ownershipStatus: record.ownershipStatus,
      ownershipDetail: record.ownershipDetail,
      tlsStatus: record.tlsStatus,
      tlsDetail: record.tlsDetail,
      certificateValidFrom: record.certificateValidFrom,
      certificateValidTo: record.certificateValidTo,
      certificateSubjectName: record.certificateSubjectName,
      certificateIssuerName: record.certificateIssuerName,
      certificateSubjectAltNames: record.certificateSubjectAltNames,
      certificateChainSubjects: record.certificateChainSubjects,
      certificateChainEntries: record.certificateChainEntries,
      certificateRootSubjectName: record.certificateRootSubjectName,
      certificateChainChangedAt: record.certificateChainChangedAt,
      certificateChainObservedCount: record.certificateChainObservedCount,
      certificateChainLastHealthyAt: record.certificateChainLastHealthyAt,
      certificateLastHealthyChainEntries: record.certificateLastHealthyChainEntries,
      certificatePathValidityChangedAt: record.certificatePathValidityChangedAt,
      certificatePathValidityObservedCount: record.certificatePathValidityObservedCount,
      certificatePathValidityLastHealthyAt: record.certificatePathValidityLastHealthyAt,
      certificateValidationReason: toCertificateValidationReason(record.certificateValidationReason),
      certificateFingerprintSha256: record.certificateFingerprintSha256,
      certificateSerialNumber: record.certificateSerialNumber,
      certificateFirstObservedAt: record.certificateFirstObservedAt,
      certificateChangedAt: record.certificateChangedAt,
      certificateLastRotatedAt: record.certificateLastRotatedAt,
      certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
      certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
      diagnosticsCheckedAt: record.diagnosticsCheckedAt,
      ownershipStatusChangedAt: record.ownershipStatusChangedAt,
      tlsStatusChangedAt: record.tlsStatusChangedAt,
      ownershipVerifiedAt: record.ownershipVerifiedAt,
      tlsReadyAt: record.tlsReadyAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deploymentStatus: record.deploymentStatus,
      runtimeUrl: record.runtimeUrl,
      ...toDeploymentServiceMetadata({
        serviceName: record.serviceName,
        metadata: record.deploymentMetadata
      })
    } satisfies ProjectDomainRecord;
  }

  async removeDomain(projectId: string, domainId: string) {
    const rows = await this.db
      .delete(domains)
      .where(and(
        eq(domains.projectId, projectId),
        eq(domains.id, domainId)
      ))
      .returning({ id: domains.id });

    return rows[0] ?? null;
  }

  async updateDomainDiagnostics(input: UpdateProjectDomainDiagnosticsInput) {
    const [record] = await this.db
      .update(domains)
      .set({
        verificationStatus: input.verificationStatus,
        verificationDetail: input.verificationDetail,
        verificationCheckedAt: input.verificationCheckedAt,
        verificationStatusChangedAt: input.verificationStatusChangedAt,
        verificationVerifiedAt: input.verificationVerifiedAt,
        ownershipStatus: input.ownershipStatus,
        ownershipDetail: input.ownershipDetail,
        tlsStatus: input.tlsStatus,
        tlsDetail: input.tlsDetail,
        certificateValidFrom: input.certificateValidFrom,
        certificateValidTo: input.certificateValidTo,
        certificateSubjectName: input.certificateSubjectName,
        certificateIssuerName: input.certificateIssuerName,
        certificateSubjectAltNames: input.certificateSubjectAltNames,
        certificateChainSubjects: input.certificateChainSubjects,
        certificateChainEntries: input.certificateChainEntries,
        certificateRootSubjectName: input.certificateRootSubjectName,
        certificateChainChangedAt: input.certificateChainChangedAt,
        certificateChainObservedCount: input.certificateChainObservedCount,
        certificateChainLastHealthyAt: input.certificateChainLastHealthyAt,
        certificateLastHealthyChainEntries: input.certificateLastHealthyChainEntries,
        certificatePathValidityChangedAt: input.certificatePathValidityChangedAt,
        certificatePathValidityObservedCount: input.certificatePathValidityObservedCount,
        certificatePathValidityLastHealthyAt: input.certificatePathValidityLastHealthyAt,
        certificateValidationReason: input.certificateValidationReason,
        certificateFingerprintSha256: input.certificateFingerprintSha256,
        certificateSerialNumber: input.certificateSerialNumber,
        certificateFirstObservedAt: input.certificateFirstObservedAt,
        certificateChangedAt: input.certificateChangedAt,
        certificateLastRotatedAt: input.certificateLastRotatedAt,
        certificateGuidanceChangedAt: input.certificateGuidanceChangedAt,
        certificateGuidanceObservedCount: input.certificateGuidanceObservedCount,
        diagnosticsCheckedAt: input.diagnosticsCheckedAt,
        ownershipStatusChangedAt: input.ownershipStatusChangedAt,
        tlsStatusChangedAt: input.tlsStatusChangedAt,
        ownershipVerifiedAt: input.ownershipVerifiedAt,
        tlsReadyAt: input.tlsReadyAt
      })
      .where(and(
        eq(domains.projectId, input.projectId),
        eq(domains.id, input.domainId)
      ))
      .returning({ id: domains.id });

    return record ?? null;
  }

  async addDomainEvents(input: CreateProjectDomainEventInput[]) {
    if (input.length === 0) {
      return [];
    }

    return this.db
      .insert(projectDomainEvents)
      .values(input.map((event) => ({
        projectId: event.projectId,
        domainId: event.domainId,
        kind: event.kind,
        previousStatus: event.previousStatus,
        nextStatus: event.nextStatus,
        detail: event.detail,
        createdAt: event.createdAt
      })))
      .returning({ id: projectDomainEvents.id });
  }

  async listRecentDomainEvents(input: {
    projectId: string;
    limitPerDomain?: number;
    kinds?: readonly ProjectDomainEventKind[];
  }): Promise<ProjectDomainEventRecord[]> {
    const kindFilter = input.kinds && input.kinds.length > 0
      ? sql` and ${projectDomainEvents.kind} in (${sql.join(
        input.kinds.map((kind) => sql`${kind}`),
        sql`, `
      )})`
      : sql``;

    if (!input.limitPerDomain) {
      const result = await this.db.execute(sql<{
        id: string;
        project_id: string;
        domain_id: string;
        kind: ProjectDomainEventKind;
        previous_status: string | null;
        next_status: string;
        detail: string;
        created_at: Date;
      }>`
        select
          ${projectDomainEvents.id} as id,
          ${projectDomainEvents.projectId} as project_id,
          ${projectDomainEvents.domainId} as domain_id,
          ${projectDomainEvents.kind} as kind,
          ${projectDomainEvents.previousStatus} as previous_status,
          ${projectDomainEvents.nextStatus} as next_status,
          ${projectDomainEvents.detail} as detail,
          ${projectDomainEvents.createdAt} as created_at
        from ${projectDomainEvents}
        where ${projectDomainEvents.projectId} = ${input.projectId}${kindFilter}
        order by ${projectDomainEvents.domainId} asc, ${projectDomainEvents.createdAt} desc
      `);

      return result.rows.map((row: {
        id: string;
        project_id: string;
        domain_id: string;
        kind: ProjectDomainEventKind;
        previous_status: string | null;
        next_status: string;
        detail: string;
        created_at: Date;
      }) => ({
        id: row.id,
        projectId: row.project_id,
        domainId: row.domain_id,
        kind: row.kind,
        previousStatus: row.previous_status,
        nextStatus: row.next_status,
        detail: row.detail,
        createdAt: row.created_at
      })) satisfies ProjectDomainEventRecord[];
    }

    const result = await this.db.execute(sql<{
      id: string;
      project_id: string;
      domain_id: string;
      kind: ProjectDomainEventKind;
      previous_status: string | null;
      next_status: string;
      detail: string;
      created_at: Date;
    }>`
      select id, project_id, domain_id, kind, previous_status, next_status, detail, created_at
      from (
        select
          ${projectDomainEvents.id} as id,
          ${projectDomainEvents.projectId} as project_id,
          ${projectDomainEvents.domainId} as domain_id,
          ${projectDomainEvents.kind} as kind,
          ${projectDomainEvents.previousStatus} as previous_status,
          ${projectDomainEvents.nextStatus} as next_status,
          ${projectDomainEvents.detail} as detail,
          ${projectDomainEvents.createdAt} as created_at,
          row_number() over (
            partition by ${projectDomainEvents.domainId}
            order by ${projectDomainEvents.createdAt} desc
          ) as row_num
        from ${projectDomainEvents}
        where ${projectDomainEvents.projectId} = ${input.projectId}${kindFilter}
      ) recent_domain_events
      where row_num <= ${input.limitPerDomain}
      order by domain_id asc, created_at desc
    `);

    return result.rows.map((row: {
      id: string;
      project_id: string;
      domain_id: string;
      kind: ProjectDomainEventKind;
      previous_status: string | null;
      next_status: string;
      detail: string;
      created_at: Date;
    }) => ({
      id: row.id,
      projectId: row.project_id,
      domainId: row.domain_id,
      kind: row.kind,
      previousStatus: row.previous_status,
      nextStatus: row.next_status,
      detail: row.detail,
      createdAt: row.created_at
    })) satisfies ProjectDomainEventRecord[];
  }

  async listProjectIdsForDomainDiagnosticsRefresh(input: {
    staleBefore: Date;
    limit: number;
  }) {
    const result = await this.db.execute(sql<{ project_id: string }>`
      select project_id
      from ${domains}
      where diagnostics_checked_at is null
         or diagnostics_checked_at < ${input.staleBefore}
      group by project_id
      order by min(coalesce(diagnostics_checked_at, created_at)) asc
      limit ${input.limit}
    `);

    return result.rows.map((row: { project_id: string }) => row.project_id);
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

  async deleteProject(projectId: string) {
    return this.db.transaction(async (tx) => {
      const projectDeployments = await tx
        .select({
          id: deployments.id
        })
        .from(deployments)
        .where(eq(deployments.projectId, projectId));
      const deploymentIds = projectDeployments.map((deployment) => deployment.id);

      await tx
        .delete(domains)
        .where(eq(domains.projectId, projectId));

      await tx
        .delete(environmentVariables)
        .where(eq(environmentVariables.projectId, projectId));

      if (deploymentIds.length > 0) {
        await tx
          .delete(deploymentLogs)
          .where(inArray(deploymentLogs.deploymentId, deploymentIds));

        await tx
          .delete(containers)
          .where(inArray(containers.deploymentId, deploymentIds));

        await tx
          .delete(deployments)
          .where(eq(deployments.projectId, projectId));
      }

      const [deletedProject] = await tx
        .delete(projects)
        .where(eq(projects.id, projectId))
        .returning({
          id: projects.id
        });

      return deletedProject ?? null;
    });
  }
}
