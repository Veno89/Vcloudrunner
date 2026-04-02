import type { DbClient } from '../../db/client.js';
import {
  normalizeProjectServices,
  getPrimaryProjectService
} from '@vcloudrunner/shared-types';
import { env } from '../../config/env.js';
import {
  ProjectDomainAlreadyExistsError,
  ProjectDomainDeactivationFailedError,
  ProjectDomainNotFoundError,
  ProjectDomainRemovalNotAllowedError,
  ProjectDomainReservedError,
  ProjectDeletionNotAllowedError,
  ProjectInvitationAlreadyExistsError,
  ProjectInvitationEmailMismatchError,
  ProjectInvitationNotFoundError,
  ProjectInvitationNotPendingError,
  ProjectMemberAlreadyExistsError,
  ProjectMemberNotFoundError,
  ProjectOwnerMembershipImmutableError,
  ProjectNotFoundError,
  ProjectServiceRemovalBlockedError,
  ProjectSlugTakenError,
  UserProfileRequiredError
} from '../../server/domain-errors.js';
import {
  disabledProjectInvitationDeliveryService,
  type ProjectInvitationDeliveryService
} from '../../services/project-invitation-delivery.service.js';
import {
  defaultProjectDomainDiagnosticsService,
  type ProjectDomainDiagnosticsInspector
} from '../../services/project-domain-diagnostics.service.js';
import {
  defaultProjectDomainRouteService,
  type ProjectDomainRouteManager
} from '../../services/project-domain-route.service.js';
import {
  type CreateProjectInput,
  type UpdateProjectInput,
  type CreateProjectDomainInput,
  ProjectsRepository,
  ProjectDomainsRepository,
  ProjectMembersRepository,
  type ProjectDomainRecord,
  type ProjectDomainEventRecord,
  type ProjectInvitationClaimRecord
} from './projects.repository.js';
import { ProjectDatabasesService } from '../project-databases/project-databases.service.js';
import {
  normalizeEmailAddress,
  createInvitationClaimToken,
  createProjectDomainVerificationToken,
  isDomainsHostUniqueViolation,
  normalizeProjectDomainHost,
  createDefaultProjectDomainHost,
  usesReservedPlatformHost,
  statusPriority,
  mapProjectDomainStatus,
  withProjectDomainDiagnosticsState,
  createPersistedProjectDomainDiagnosticsState,
  createProjectDomainTransitionEvents,
  createProjectDomainCertificateHistorySummary,
  PROJECT_DOMAIN_CERTIFICATE_HISTORY_EVENT_KINDS,
  type ProjectDomainStatusRecord,
  type ProjectDomainStatusWithDiagnosticsRecord,
  type ProjectInviteResult,
  type ProjectInvitationRedeliveryResult
} from './project-domain-helpers.js';

// Re-export types for backward compatibility
export type {
  ProjectDomainStatusRecord,
  ProjectDomainStatusWithDiagnosticsRecord,
  ProjectDomainCertificateState,
  ProjectDomainCertificateValidityStatus,
  ProjectDomainCertificateTrustStatus,
  ProjectDomainCertificateGuidanceState,
  ProjectDomainCertificateIdentityStatus,
  ProjectDomainCertificateAttentionStatus,
  ProjectDomainCertificateChainStatus,
  ProjectDomainCertificateChainAttentionStatus,
  ProjectDomainCertificateChainHistoryStatus,
  ProjectDomainCertificatePathValidityStatus,
  ProjectDomainCertificateHistoryEventKind,
  ProjectDomainCertificateHistorySummaryRecord,
  ProjectInviteResult,
  ProjectInvitationRedeliveryResult
} from './project-domain-helpers.js';

interface PostgresError {
  code?: string;
  constraint?: string;
}

export class ProjectsService {
  private readonly repository: ProjectsRepository;
  private readonly domainsRepository: ProjectDomainsRepository;
  private readonly membersRepository: ProjectMembersRepository;
  private readonly invitationDelivery: ProjectInvitationDeliveryService;
  private readonly domainDiagnostics: ProjectDomainDiagnosticsInspector;
  private readonly domainRoutes: ProjectDomainRouteManager;
  private readonly projectDatabasesService: ProjectDatabasesService;

  constructor(
    db: DbClient,
    invitationDelivery: ProjectInvitationDeliveryService = disabledProjectInvitationDeliveryService,
    domainDiagnostics: ProjectDomainDiagnosticsInspector = defaultProjectDomainDiagnosticsService,
    domainRoutes: ProjectDomainRouteManager = defaultProjectDomainRouteService,
    projectDatabasesService: ProjectDatabasesService = new ProjectDatabasesService(db)
  ) {
    this.repository = new ProjectsRepository(db);
    this.domainsRepository = new ProjectDomainsRepository(db);
    this.membersRepository = new ProjectMembersRepository(db);
    this.invitationDelivery = invitationDelivery;
    this.domainDiagnostics = domainDiagnostics;
    this.domainRoutes = domainRoutes;
    this.projectDatabasesService = projectDatabasesService;
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

  async updateProject(projectId: string, input: UpdateProjectInput) {
    if (input.services) {
      const activeDeployments = await this.repository.listActiveDeployments(projectId);
      const newServiceNames = new Set(input.services.map((s) => s.name));
      const blockedRemovals = activeDeployments
        .filter((d) => !newServiceNames.has(d.serviceName))
        .map((d) => d.serviceName);

      if (blockedRemovals.length > 0) {
        throw new ProjectServiceRemovalBlockedError([...new Set(blockedRemovals)]);
      }

      input = { ...input, services: normalizeProjectServices(input.services) };
    }

    const updated = await this.repository.updateProject(projectId, input);
    if (!updated) {
      throw new ProjectNotFoundError();
    }

    return updated;
  }

  listProjectsByUser(userId: string) {
    return this.repository.findAllByUser(userId);
  }

  getProjectById(projectId: string) {
    return this.repository.findById(projectId);
  }

  checkMembership(projectId: string, userId: string) {
    return this.membersRepository.checkMembership(projectId, userId);
  }

  getMembership(projectId: string, userId: string) {
    return this.membersRepository.findMembership(projectId, userId);
  }

  listProjectMembers(projectId: string) {
    return this.membersRepository.listMembers(projectId);
  }

  listProjectInvitations(projectId: string) {
    return this.membersRepository.listInvitations(projectId);
  }

  async listProjectIdsForDomainDiagnosticsRefresh(input: {
    staleBefore: Date;
    limit: number;
  }) {
    return this.domainsRepository.listProjectIdsForDomainDiagnosticsRefresh(input);
  }

  private async loadProjectDomainStatusRecords(projectId: string) {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const normalizedServices = normalizeProjectServices(project.services);
    const defaultHost = createDefaultProjectDomainHost(project.slug);
    const records = await this.domainsRepository.listDomains(projectId);
    const mappedRecords = records
      .map((record) => mapProjectDomainStatus({
        slug: project.slug,
        services: normalizedServices
      }, record))
      .sort((left, right) => {
        const statusDiff = statusPriority(left.routeStatus) - statusPriority(right.routeStatus);
        if (statusDiff !== 0) {
          return statusDiff;
        }

        const updatedAtDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
        if (updatedAtDiff !== 0) {
          return updatedAtDiff;
        }

        return left.host.localeCompare(right.host);
      });

    return {
      defaultHost,
      mappedRecords
    };
  }

  private async refreshMappedProjectDomainDiagnostics(input: {
    projectId: string;
    defaultHost: string;
    mappedRecords: ProjectDomainStatusRecord[];
  }) {
    const { projectId, defaultHost, mappedRecords } = input;
    if (mappedRecords.length === 0) {
      return [];
    }

    const diagnostics = await this.domainDiagnostics.inspectDomains({
      defaultHost,
      domains: mappedRecords.map((record) => ({
        host: record.host,
        routeStatus: record.routeStatus,
        verificationToken: record.verificationToken
      }))
    });
    const checkedAt = new Date();
    const refreshedRecords = mappedRecords.map((record, index) =>
      createPersistedProjectDomainDiagnosticsState({
        record,
        defaultHost,
        diagnostics: diagnostics[index],
        checkedAt
      })
    );
    const domainEvents = refreshedRecords.flatMap((record, index) =>
      createProjectDomainTransitionEvents({
        previousRecord: mappedRecords[index]!,
        defaultHost,
        nextRecord: record,
        occurredAt: checkedAt
      })
    );

    await Promise.all(
      refreshedRecords.map((record) =>
        this.domainsRepository.updateDomainDiagnostics({
          projectId,
          domainId: record.id,
          verificationStatus: record.verificationStatus,
          verificationDetail: record.verificationDetail,
          verificationCheckedAt: record.verificationCheckedAt ?? checkedAt,
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
          certificateValidationReason: record.certificateValidationReason,
          certificateFingerprintSha256: record.certificateFingerprintSha256,
          certificateSerialNumber: record.certificateSerialNumber,
          certificateFirstObservedAt: record.certificateFirstObservedAt,
          certificateChangedAt: record.certificateChangedAt,
          certificateLastRotatedAt: record.certificateLastRotatedAt,
          certificateGuidanceChangedAt: record.certificateGuidanceChangedAt,
          certificateGuidanceObservedCount: record.certificateGuidanceObservedCount,
          diagnosticsCheckedAt: checkedAt,
          ownershipStatusChangedAt: record.ownershipStatusChangedAt,
          tlsStatusChangedAt: record.tlsStatusChangedAt,
          ownershipVerifiedAt: record.ownershipVerifiedAt,
          tlsReadyAt: record.tlsReadyAt
        })
      )
    );

    await this.domainsRepository.addDomainEvents(domainEvents);

    return this.attachRecentDomainEvents(projectId, refreshedRecords);
  }

  private async attachRecentDomainEvents(
    projectId: string,
    records: ProjectDomainStatusWithDiagnosticsRecord[]
  ): Promise<ProjectDomainStatusWithDiagnosticsRecord[]> {
    if (records.length === 0) {
      return [];
    }

    const recentEvents = await this.domainsRepository.listRecentDomainEvents({
      projectId,
      limitPerDomain: 6
    });
    const certificateHistoryEvents = await this.domainsRepository.listRecentDomainEvents({
      projectId,
      kinds: PROJECT_DOMAIN_CERTIFICATE_HISTORY_EVENT_KINDS
    });
    const eventsByDomainId = new Map<string, ProjectDomainEventRecord[]>();
    const certificateHistoryEventsByDomainId = new Map<string, ProjectDomainEventRecord[]>();

    for (const event of recentEvents) {
      const existing = eventsByDomainId.get(event.domainId);
      if (existing) {
        existing.push(event);
      } else {
        eventsByDomainId.set(event.domainId, [event]);
      }
    }

    for (const event of certificateHistoryEvents) {
      const existing = certificateHistoryEventsByDomainId.get(event.domainId);
      if (existing) {
        existing.push(event);
      } else {
        certificateHistoryEventsByDomainId.set(event.domainId, [event]);
      }
    }

    return records.map((record) => ({
      ...record,
      certificateHistorySummary:
        createProjectDomainCertificateHistorySummary(
          certificateHistoryEventsByDomainId.get(record.id) ?? []
        ),
      recentEvents: eventsByDomainId.get(record.id) ?? []
    }));
  }

  async refreshProjectDomainDiagnostics(projectId: string): Promise<ProjectDomainStatusWithDiagnosticsRecord[]> {
    const { defaultHost, mappedRecords } = await this.loadProjectDomainStatusRecords(projectId);
    return this.refreshMappedProjectDomainDiagnostics({
      projectId,
      defaultHost,
      mappedRecords
    });
  }

  async listProjectDomains(
    projectId: string,
    options: { includeDiagnostics?: boolean } = {}
  ): Promise<ProjectDomainStatusWithDiagnosticsRecord[]> {
    const { defaultHost, mappedRecords } = await this.loadProjectDomainStatusRecords(projectId);
    const evaluatedAt = new Date(Date.now());
    const diagnosticsStateRecords = mappedRecords.map((record) => withProjectDomainDiagnosticsState({
      record,
      defaultHost,
      evaluatedAt
    }));

    if (!options.includeDiagnostics) {
      return this.attachRecentDomainEvents(projectId, diagnosticsStateRecords);
    }

    return this.refreshMappedProjectDomainDiagnostics({
      projectId,
      defaultHost,
      mappedRecords
    });
  }

  async createProjectDomain(input: {
    projectId: string;
    host: string;
  }): Promise<ProjectDomainStatusRecord> {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const normalizedHost = normalizeProjectDomainHost(input.host);
    if (usesReservedPlatformHost(normalizedHost)) {
      throw new ProjectDomainReservedError();
    }

    const services = normalizeProjectServices(project.services);
    const publicService = getPrimaryProjectService(services);
    const targetPort = publicService.runtime?.containerPort ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT;

    let record: ProjectDomainRecord;
    try {
      record = await this.domainsRepository.createDomain({
        projectId: input.projectId,
        host: normalizedHost,
        targetPort,
        verificationToken: createProjectDomainVerificationToken()
      } satisfies CreateProjectDomainInput);
    } catch (error) {
      if (isDomainsHostUniqueViolation(error)) {
        throw new ProjectDomainAlreadyExistsError();
      }

      throw error;
    }

    return mapProjectDomainStatus({
      slug: project.slug,
      services
    }, record);
  }

  async verifyProjectDomainClaim(input: {
    projectId: string;
    domainId: string;
  }): Promise<ProjectDomainStatusWithDiagnosticsRecord> {
    const { defaultHost, mappedRecords } = await this.loadProjectDomainStatusRecords(input.projectId);
    const record = mappedRecords.find((candidate) => candidate.id === input.domainId);

    if (!record) {
      throw new ProjectDomainNotFoundError();
    }

    const [verifiedDomain] = await this.refreshMappedProjectDomainDiagnostics({
      projectId: input.projectId,
      defaultHost,
      mappedRecords: [record]
    });

    if (!verifiedDomain) {
      throw new ProjectDomainNotFoundError();
    }

    return verifiedDomain;
  }

  async removeProjectDomain(input: {
    projectId: string;
    domainId: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const record = await this.domainsRepository.findDomainById(input.projectId, input.domainId);
    if (!record) {
      throw new ProjectDomainNotFoundError();
    }

    if (record.host === createDefaultProjectDomainHost(project.slug)) {
      throw new ProjectDomainReservedError();
    }

    if (record.deploymentStatus === 'queued' || record.deploymentStatus === 'building') {
      throw new ProjectDomainRemovalNotAllowedError();
    }

    if (record.deploymentId) {
      try {
        await this.domainRoutes.deactivateRoute({
          host: record.host
        });
      } catch {
        throw new ProjectDomainDeactivationFailedError(record.host);
      }
    }

    const removed = await this.domainsRepository.removeDomain(input.projectId, input.domainId);
    if (!removed) {
      throw new ProjectDomainNotFoundError();
    }
  }

  async getProjectInvitationClaim(claimToken: string): Promise<ProjectInvitationClaimRecord> {
    const invitation = await this.membersRepository.findInvitationClaimByToken(claimToken);
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

    const existingInvitation = await this.membersRepository.findInvitationDetails(
      input.projectId,
      input.invitationId
    );
    if (!existingInvitation || existingInvitation.status !== 'pending') {
      throw new ProjectInvitationNotFoundError();
    }

    const updatedRecord = await this.membersRepository.updateInvitation(input);
    if (!updatedRecord) {
      throw new ProjectInvitationNotFoundError();
    }

    const updatedInvitation = await this.membersRepository.findInvitationDetails(
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

    const existingInvitation = await this.membersRepository.findInvitationDetails(
      input.projectId,
      input.invitationId
    );
    if (!existingInvitation || existingInvitation.status !== 'pending') {
      throw new ProjectInvitationNotFoundError();
    }

    const cancelledRecord = await this.membersRepository.cancelInvitation(input.projectId, input.invitationId);
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

    const invitation = await this.membersRepository.findInvitationDetails(input.projectId, input.invitationId);
    if (!invitation) {
      throw new ProjectInvitationNotFoundError();
    }

    if (invitation.status !== 'pending') {
      throw new ProjectInvitationNotPendingError();
    }

    const claimRecord = await this.membersRepository.findInvitationClaimByToken(invitation.claimToken);
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
    const invitation = await this.membersRepository.findInvitationClaimByToken(input.claimToken);
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

    const user = await this.membersRepository.findPersistedUserById(input.actorUserId);
    if (!user) {
      throw new UserProfileRequiredError();
    }

    if (normalizeEmailAddress(user.email) !== normalizeEmailAddress(invitation.email)) {
      throw new ProjectInvitationEmailMismatchError();
    }

    const existingMembership = await this.membersRepository.findMembership(
      invitation.projectId,
      input.actorUserId
    );
    if (!existingMembership) {
      await this.membersRepository.addMember({
        projectId: invitation.projectId,
        userId: input.actorUserId,
        role: invitation.role,
        invitedBy: invitation.invitedBy ?? input.actorUserId
      });
    }

    const acceptedRecord = await this.membersRepository.acceptInvitation(invitation.id, input.actorUserId);
    if (!acceptedRecord) {
      throw new ProjectInvitationNotPendingError();
    }

    const acceptedInvitation = await this.membersRepository.findInvitationClaimByToken(input.claimToken);
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

    const existingMembership = await this.membersRepository.findMemberDetails(input.projectId, input.userId);
    if (!existingMembership) {
      throw new ProjectMemberNotFoundError();
    }

    if (existingMembership.role === input.role) {
      return existingMembership;
    }

    await this.membersRepository.updateMemberRole(input);

    const updatedMembership = await this.membersRepository.findMemberDetails(input.projectId, input.userId);
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

    const existingMembership = await this.membersRepository.findMemberDetails(input.projectId, input.userId);
    if (!existingMembership) {
      throw new ProjectMemberNotFoundError();
    }

    await this.membersRepository.removeMember(input.projectId, input.userId);
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
      const existingMembership = await this.membersRepository.findMemberDetails(input.projectId, input.userId);
      if (!existingMembership) {
        throw new ProjectMemberNotFoundError();
      }

      const updatedProject = await this.membersRepository.transferOwnership({
        projectId: input.projectId,
        previousOwnerUserId: project.userId,
        nextOwnerUserId: input.userId
      });

      if (!updatedProject) {
        throw new ProjectNotFoundError();
      }
    }

    const updatedMembers = await this.membersRepository.listMembers(input.projectId);
    const nextOwner = updatedMembers.find((member) => member.userId === input.userId);
    if (!nextOwner) {
      throw new ProjectMemberNotFoundError();
    }

    return nextOwner;
  }

  async removeProject(input: {
    projectId: string;
  }) {
    const project = await this.repository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const activeDeployments = await this.repository.listActiveDeployments(input.projectId);
    if (activeDeployments.length > 0) {
      throw new ProjectDeletionNotAllowedError(
        activeDeployments.map((deployment) => deployment.serviceName)
      );
    }

    const projectDomains = await this.domainsRepository.listDomains(input.projectId);
    await this.deactivateProjectRoutes(projectDomains);

    const projectDatabases = await this.projectDatabasesService.listProjectDatabases(input.projectId);
    for (const projectDatabase of projectDatabases) {
      await this.projectDatabasesService.removeProjectDatabase({
        projectId: input.projectId,
        databaseId: projectDatabase.id
      });
    }

    const deletedProject = await this.repository.deleteProject(input.projectId);
    if (!deletedProject) {
      throw new ProjectNotFoundError();
    }
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

    const user = await this.membersRepository.findPersistedUserByEmail(normalizedEmail);
    if (user) {
      if (project.userId === user.id) {
        throw new ProjectMemberAlreadyExistsError();
      }

      const existingMembership = await this.membersRepository.findMembership(input.projectId, user.id);
      if (existingMembership) {
        throw new ProjectMemberAlreadyExistsError();
      }

      try {
        const membership = await this.membersRepository.addMember({
          projectId: input.projectId,
          userId: user.id,
          role: input.role,
          invitedBy: input.invitedBy
        });

        const activeInvitation = await this.membersRepository.findActiveInvitationByEmail(
          input.projectId,
          normalizedEmail
        );
        if (activeInvitation) {
          await this.membersRepository.acceptInvitation(activeInvitation.id, user.id);
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
      const existingInvitation = await this.membersRepository.findActiveInvitationByEmail(
        input.projectId,
        normalizedEmail
      );
      if (existingInvitation) {
        throw new ProjectInvitationAlreadyExistsError();
      }

      const invitation = await this.membersRepository.addInvitation({
        projectId: input.projectId,
        email: normalizedEmail,
        claimToken: createInvitationClaimToken(),
        role: input.role,
        invitedBy: input.invitedBy
      });

      const invitationClaimRecord = await this.membersRepository.findInvitationClaimByToken(invitation.claimToken);
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

  private async deactivateProjectRoutes(domains: ProjectDomainRecord[]) {
    for (const record of domains) {
      if (!record.deploymentId) {
        continue;
      }

      try {
        await this.domainRoutes.deactivateRoute({
          host: record.host
        });
      } catch {
        throw new ProjectDomainDeactivationFailedError(record.host);
      }
    }
  }
}
