import { randomBytes } from 'node:crypto';
import type { DbClient } from '../../db/client.js';
import {
  getPrimaryProjectService,
  normalizeProjectServices
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
  ProjectSlugTakenError,
  UserProfileRequiredError
} from '../../server/domain-errors.js';
import {
  disabledProjectInvitationDeliveryService,
  type ProjectInvitationDeliveryResult,
  type ProjectInvitationDeliveryService
} from '../../services/project-invitation-delivery.service.js';
import {
  createProjectDomainVerificationRecordName,
  createProjectDomainVerificationRecordValue,
  defaultProjectDomainDiagnosticsService,
  type ProjectDomainCertificateChainEntry,
  type ProjectDomainCertificateValidationReason,
  type ProjectDomainDiagnosticsInspector,
  type ProjectDomainVerificationStatus,
  type ProjectDomainOwnershipStatus,
  type ProjectDomainTlsStatus
} from '../../services/project-domain-diagnostics.service.js';
import {
  defaultProjectDomainRouteService,
  type ProjectDomainRouteManager
} from '../../services/project-domain-route.service.js';

interface PostgresError {
  code?: string;
  constraint?: string;
}
import {
  type CreateProjectDomainEventInput,
  type CreateProjectDomainInput,
  ProjectsRepository,
  type CreateProjectInput,
  type ProjectDomainEventKind,
  type ProjectDomainRecord,
  type ProjectDomainEventRecord,
  type ProjectInvitationClaimRecord,
  type ProjectInvitationRecord,
  type ProjectMemberRecord
} from './projects.repository.js';
import { ProjectDatabasesService } from '../project-databases/project-databases.service.js';

function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function createInvitationClaimToken() {
  return randomBytes(18).toString('hex');
}

function createProjectDomainVerificationToken() {
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

export interface ProjectDomainStatusRecord extends ProjectDomainRecord {
  routeStatus: 'active' | 'degraded' | 'stale' | 'pending';
  statusDetail: string;
}

export type ProjectDomainCertificateState =
  | 'managed'
  | 'awaiting-route'
  | 'awaiting-dns'
  | 'provisioning'
  | 'active'
  | 'issuance-attention'
  | 'renewal-attention'
  | 'check-unavailable';

export type ProjectDomainCertificateValidityStatus =
  | 'valid'
  | 'expiring-soon'
  | 'expired'
  | 'not-yet-valid'
  | 'unavailable';

export type ProjectDomainCertificateTrustStatus =
  | 'trusted'
  | 'date-invalid'
  | 'hostname-mismatch'
  | 'self-signed'
  | 'issuer-untrusted'
  | 'validation-failed'
  | 'unavailable';

export type ProjectDomainCertificateGuidanceState =
  | 'healthy'
  | 'wait-for-route'
  | 'wait-for-dns'
  | 'wait-for-issuance'
  | 'renew-soon'
  | 'renew-now'
  | 'fix-coverage'
  | 'fix-trust'
  | 'refresh-checks';

export type ProjectDomainCertificateIdentityStatus =
  | 'unavailable'
  | 'first-observed'
  | 'stable'
  | 'rotated'
  | 'rotated-attention';

export type ProjectDomainCertificateAttentionStatus =
  | 'healthy'
  | 'monitor'
  | 'action-needed'
  | 'persistent-action-needed';

export type ProjectDomainCertificateChainStatus =
  | 'unavailable'
  | 'leaf-only'
  | 'chained'
  | 'incomplete'
  | 'private-root'
  | 'self-signed-leaf';

export type ProjectDomainCertificateChainAttentionStatus =
  | 'healthy'
  | 'monitor'
  | 'action-needed'
  | 'persistent-action-needed';

export type ProjectDomainCertificateChainHistoryStatus =
  | 'unavailable'
  | 'baseline-missing'
  | 'stable'
  | 'rotated'
  | 'degraded'
  | 'drifted';

export type ProjectDomainCertificatePathValidityStatus =
  | 'valid'
  | 'expiring-soon'
  | 'expired'
  | 'not-yet-valid'
  | 'unavailable';

export type ProjectDomainCertificateHistoryEventKind =
  | 'certificate_attention'
  | 'certificate_chain'
  | 'certificate_trust'
  | 'certificate_path_validity';

export interface ProjectDomainCertificateHistorySummaryRecord {
  eventCount: number;
  incidentCount: number;
  recoveryCount: number;
  trustIncidentCount: number;
  pathWarningCount: number;
  pathIncidentCount: number;
  chainIncidentCount: number;
  attentionIncidentCount: number;
  lastEventAt: Date | null;
  lastIncidentAt: Date | null;
  lastIncidentKind: ProjectDomainCertificateHistoryEventKind | null;
  lastRecoveryAt: Date | null;
  lastRecoveryKind: ProjectDomainCertificateHistoryEventKind | null;
  lastPathWarningAt: Date | null;
}

export interface ProjectDomainStatusWithDiagnosticsRecord
  extends ProjectDomainStatusRecord {
  verificationStatus: ProjectDomainVerificationStatus;
  verificationDetail: string;
  verificationCheckedAt: Date | null;
  verificationStatusChangedAt: Date | null;
  verificationVerifiedAt: Date | null;
  ownershipStatus: ProjectDomainOwnershipStatus;
  ownershipDetail: string;
  tlsStatus: ProjectDomainTlsStatus;
  tlsDetail: string;
  certificateState: ProjectDomainCertificateState;
  certificateTitle: string;
  certificateDetail: string;
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
  certificateChainSubjects: string[];
  certificateChainEntries: ProjectDomainCertificateChainEntry[];
  certificateIntermediateSubjectNames: string[];
  certificateChainDepth: number;
  certificateRootSubjectName: string | null;
  certificateChainChangedAt: Date | null;
  certificateChainObservedCount: number;
  certificateChainLastHealthyAt: Date | null;
  certificateLastHealthyChainEntries: ProjectDomainCertificateChainEntry[];
  certificateLastHealthyIntermediateSubjectNames: string[];
  certificateLastHealthyChainDepth: number;
  certificatePathValidityStatus: ProjectDomainCertificatePathValidityStatus;
  certificatePathValidityTitle: string;
  certificatePathValidityDetail: string;
  certificatePathValidityChangedAt: Date | null;
  certificatePathValidityObservedCount: number;
  certificatePathValidityLastHealthyAt: Date | null;
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  certificateValidityStatus: ProjectDomainCertificateValidityStatus;
  certificateValidityDetail: string;
  certificateTrustStatus: ProjectDomainCertificateTrustStatus;
  certificateTrustDetail: string;
  certificateIdentityStatus: ProjectDomainCertificateIdentityStatus;
  certificateIdentityTitle: string;
  certificateIdentityDetail: string;
  certificateGuidanceState: ProjectDomainCertificateGuidanceState;
  certificateGuidanceTitle: string;
  certificateGuidanceDetail: string;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  certificateAttentionStatus: ProjectDomainCertificateAttentionStatus;
  certificateAttentionTitle: string;
  certificateAttentionDetail: string;
  certificateChainStatus: ProjectDomainCertificateChainStatus;
  certificateChainTitle: string;
  certificateChainDetail: string;
  certificateChainAttentionStatus: ProjectDomainCertificateChainAttentionStatus;
  certificateChainAttentionTitle: string;
  certificateChainAttentionDetail: string;
  certificateChainHistoryStatus: ProjectDomainCertificateChainHistoryStatus;
  certificateChainHistoryTitle: string;
  certificateChainHistoryDetail: string;
  diagnosticsCheckedAt: Date | null;
  diagnosticsFreshnessStatus: 'fresh' | 'stale' | 'unchecked';
  diagnosticsFreshnessDetail: string;
  claimState:
    | 'managed'
    | 'publish-verification-record'
    | 'fix-verification-record'
    | 'configure-dns'
    | 'fix-dns'
    | 'refresh-checks'
    | 'redeploy-public-service'
    | 'wait-for-https'
    | 'review-https'
    | 'healthy';
  claimTitle: string;
  claimDetail: string;
  claimDnsRecordType: 'CNAME' | 'TXT' | null;
  claimDnsRecordName: string | null;
  claimDnsRecordValue: string | null;
  verificationDnsRecordType: 'TXT' | null;
  verificationDnsRecordName: string | null;
  verificationDnsRecordValue: string | null;
  routingDnsRecordType: 'CNAME' | null;
  routingDnsRecordName: string | null;
  routingDnsRecordValue: string | null;
  certificateHistorySummary: ProjectDomainCertificateHistorySummaryRecord;
  recentEvents: ProjectDomainEventRecord[];
  ownershipStatusChangedAt: Date | null;
  tlsStatusChangedAt: Date | null;
  ownershipVerifiedAt: Date | null;
  tlsReadyAt: Date | null;
}

function isDomainsHostUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as { code?: string; constraint?: string };
  return pgError.code === '23505' && pgError.constraint === 'domains_host_unique';
}

function normalizeProjectDomainHost(host: string) {
  return host.trim().toLowerCase().replace(/\.+$/g, '');
}

function createDefaultProjectDomainHost(projectSlug: string) {
  return `${projectSlug}.${env.PLATFORM_DOMAIN}`;
}

function usesReservedPlatformHost(host: string) {
  return host === env.PLATFORM_DOMAIN || host.endsWith(`.${env.PLATFORM_DOMAIN}`);
}

function getRuntimeUrlHost(runtimeUrl: string | null): string | null {
  if (!runtimeUrl) {
    return null;
  }

  try {
    return new URL(runtimeUrl).hostname;
  } catch {
    return null;
  }
}

function statusPriority(status: ProjectDomainStatusRecord['routeStatus']) {
  if (status === 'active') {
    return 0;
  }

  if (status === 'degraded') {
    return 1;
  }

  if (status === 'pending') {
    return 2;
  }

  return 3;
}

function mapProjectDomainStatus(
  project: {
    slug: string;
    services: ReturnType<typeof normalizeProjectServices>;
  },
  record: ProjectDomainRecord
): ProjectDomainStatusRecord {
  const defaultHost = createDefaultProjectDomainHost(project.slug);
  const primaryService = getPrimaryProjectService(project.services);
  const runtimeUrlHost = getRuntimeUrlHost(record.runtimeUrl);

  if (!record.deploymentId) {
    return {
      ...record,
      serviceName: record.serviceName ?? primaryService.name,
      serviceKind: record.serviceKind ?? primaryService.kind,
      serviceExposure: record.serviceExposure ?? primaryService.exposure,
      routeStatus: 'pending',
      statusDetail:
        record.host === defaultHost
          ? 'The default project host is reserved, but no public route has been published yet. Deploy the public service successfully to activate it.'
          : 'This custom domain is claimed for the project, but it is not yet attached to an active deployment route. Redeploy the public service to activate it.'
    };
  }

  if (record.deploymentStatus === 'running') {
    if (!record.runtimeUrl) {
      return {
        ...record,
        routeStatus: 'degraded',
        statusDetail: 'Deployment is running, but no public runtime URL is currently active for this host.'
      };
    }

    if (record.host === defaultHost && runtimeUrlHost && runtimeUrlHost !== record.host) {
      return {
        ...record,
        routeStatus: 'degraded',
        statusDetail: 'Deployment is running, but the runtime URL does not currently match this route host.'
      };
    }

    return {
      ...record,
      routeStatus: 'active',
      statusDetail: 'Route is active and serving traffic from the current running deployment.'
    };
  }

  if (record.deploymentStatus === 'queued' || record.deploymentStatus === 'building') {
    return {
      ...record,
      routeStatus: 'degraded',
      statusDetail: 'Route points at a deployment that is not yet serving traffic.'
    };
  }

  if (record.deploymentStatus === 'failed') {
    return {
      ...record,
      routeStatus: 'stale',
      statusDetail: 'Route still points at a failed deployment record and should be redeployed.'
    };
  }

  if (record.deploymentStatus === 'stopped') {
    return {
      ...record,
      routeStatus: 'stale',
      statusDetail: 'Route still points at a stopped deployment record and is no longer serving traffic.'
    };
  }

  return {
    ...record,
    routeStatus: 'stale',
    statusDetail: 'Route record is present, but it is not currently attached to an active deployment.'
  };
}

function createProjectDomainVerificationDnsFields(input: {
  host: string;
  defaultHost: string;
  verificationToken: string | null;
}) {
  if (input.host === input.defaultHost || !input.verificationToken) {
    return {
      verificationDnsRecordType: null,
      verificationDnsRecordName: null,
      verificationDnsRecordValue: null
    } satisfies Pick<
      ProjectDomainStatusWithDiagnosticsRecord,
      'verificationDnsRecordType' | 'verificationDnsRecordName' | 'verificationDnsRecordValue'
    >;
  }

  return {
    verificationDnsRecordType: 'TXT' as const,
    verificationDnsRecordName: createProjectDomainVerificationRecordName(input.host),
    verificationDnsRecordValue: createProjectDomainVerificationRecordValue(input.verificationToken)
  } satisfies Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'verificationDnsRecordType' | 'verificationDnsRecordName' | 'verificationDnsRecordValue'
  >;
}

function createProjectDomainRoutingDnsFields(input: {
  host: string;
  defaultHost: string;
}) {
  if (input.host === input.defaultHost) {
    return {
      routingDnsRecordType: null,
      routingDnsRecordName: null,
      routingDnsRecordValue: null
    } satisfies Pick<
      ProjectDomainStatusWithDiagnosticsRecord,
      'routingDnsRecordType' | 'routingDnsRecordName' | 'routingDnsRecordValue'
    >;
  }

  return {
    routingDnsRecordType: 'CNAME' as const,
    routingDnsRecordName: input.host,
    routingDnsRecordValue: input.defaultHost
  } satisfies Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'routingDnsRecordType' | 'routingDnsRecordName' | 'routingDnsRecordValue'
  >;
}

function createFallbackProjectDomainVerification(input: {
  host: string;
  defaultHost: string;
  verificationToken: string | null;
  storedStatus: ProjectDomainVerificationStatus | null;
  storedDetail: string | null;
}) {
  if (input.storedStatus && input.storedDetail) {
    return {
      verificationStatus: input.storedStatus,
      verificationDetail: input.storedDetail
    };
  }

  if (input.host === input.defaultHost) {
    return {
      verificationStatus: 'managed' as const,
      verificationDetail: 'This is the platform-managed default host for the project.'
    };
  }

  if (!input.verificationToken) {
    return {
      verificationStatus: 'unknown' as const,
      verificationDetail:
        'No ownership verification token is currently stored for this custom host. Remove and re-add the host if this persists.'
    };
  }

  const verificationDns = createProjectDomainVerificationDnsFields({
    host: input.host,
    defaultHost: input.defaultHost,
    verificationToken: input.verificationToken
  });

  return {
    verificationStatus: 'pending' as const,
    verificationDetail:
      `Publish the TXT record ${verificationDns.verificationDnsRecordName} with value ${verificationDns.verificationDnsRecordValue} to verify ownership.`
  };
}

function createFallbackProjectDomainOwnership(input: {
  host: string;
  defaultHost: string;
  storedStatus: ProjectDomainOwnershipStatus | null;
  storedDetail: string | null;
}) {
  if (input.storedStatus && input.storedDetail) {
    return {
      ownershipStatus: input.storedStatus,
      ownershipDetail: input.storedDetail
    };
  }

  if (input.host === input.defaultHost) {
    return {
      ownershipStatus: 'managed' as const,
      ownershipDetail: 'This is the platform-managed default host for the project.'
    };
  }

  return {
    ownershipStatus: 'pending' as const,
    ownershipDetail: `No routing DNS check has been recorded yet. Point this host at ${input.defaultHost} and refresh checks to verify it.`
  };
}

function createFallbackProjectDomainTls(input: {
  routeStatus: ProjectDomainStatusRecord['routeStatus'];
  ownershipStatus: ProjectDomainOwnershipStatus;
  storedStatus: ProjectDomainTlsStatus | null;
  storedDetail: string | null;
}) {
  if (input.storedStatus && input.storedDetail) {
    return {
      tlsStatus: input.storedStatus,
      tlsDetail: input.storedDetail
    };
  }

  if (input.routeStatus === 'pending') {
    return {
      tlsStatus: 'pending' as const,
      tlsDetail: 'TLS checks run after this host is attached to a running deployment route.'
    };
  }

  if (input.routeStatus === 'stale') {
    return {
      tlsStatus: 'unknown' as const,
      tlsDetail: 'TLS state is not tracked while this host points at a stale deployment.'
    };
  }

  if (input.ownershipStatus === 'mismatch') {
    return {
      tlsStatus: 'pending' as const,
      tlsDetail: 'TLS cannot be verified until routing DNS points at the platform target.'
    };
  }

  if (input.ownershipStatus === 'pending') {
    return {
      tlsStatus: 'pending' as const,
      tlsDetail: 'Refresh checks after routing DNS is configured to verify certificate status.'
    };
  }

  return {
    tlsStatus: 'pending' as const,
    tlsDetail: 'No TLS check has been recorded yet. Refresh checks to verify certificate status.'
  };
}

function createProjectDomainDiagnosticsFreshness(input: {
  diagnosticsCheckedAt: Date | null;
  evaluatedAt: Date;
}) {
  if (!input.diagnosticsCheckedAt) {
    return {
      diagnosticsFreshnessStatus: 'unchecked' as const,
      diagnosticsFreshnessDetail:
        'Verification, DNS, and TLS checks have not been recorded for this host yet. Refresh checks to inspect current ownership and certificate state.'
    };
  }

  const ageMs = input.evaluatedAt.getTime() - input.diagnosticsCheckedAt.getTime();
  if (ageMs > env.PROJECT_DOMAIN_DIAGNOSTICS_STALE_MS) {
    return {
      diagnosticsFreshnessStatus: 'stale' as const,
      diagnosticsFreshnessDetail:
        'Stored verification, DNS, and TLS checks are older than the current freshness window and may no longer reflect the host\'s live state.'
    };
  }

  return {
    diagnosticsFreshnessStatus: 'fresh' as const,
    diagnosticsFreshnessDetail:
      'Stored verification, DNS, and TLS checks are within the current freshness window.'
  };
}

const PROJECT_DOMAIN_CERTIFICATE_EXPIRING_SOON_MS = 14 * 24 * 60 * 60 * 1000;
const PROJECT_DOMAIN_CERTIFICATE_PERSISTENT_ATTENTION_OBSERVATIONS = 2;

function formatProjectDomainCertificateTimestamp(timestamp: Date) {
  return timestamp.toISOString();
}

function formatProjectDomainCertificateFingerprintPreview(fingerprintSha256: string) {
  if (fingerprintSha256.length <= 20) {
    return fingerprintSha256;
  }

  return `${fingerprintSha256.slice(0, 12)}...${fingerprintSha256.slice(-8)}`;
}

function timestampsMatch(left: Date | null, right: Date | null) {
  return Boolean(left && right && left.getTime() === right.getTime());
}

function isProjectDomainCertificateGuidanceMonitorState(state: ProjectDomainCertificateGuidanceState) {
  return (
    state === 'wait-for-route'
    || state === 'wait-for-dns'
    || state === 'wait-for-issuance'
    || state === 'renew-soon'
  );
}

function isProjectDomainCertificateGuidanceIssueState(state: ProjectDomainCertificateGuidanceState) {
  return (
    state === 'renew-now'
    || state === 'fix-coverage'
    || state === 'fix-trust'
    || state === 'refresh-checks'
  );
}

function isProjectDomainEscalatedCertificateAttentionStatus(
  status: ProjectDomainCertificateAttentionStatus
) {
  return status === 'action-needed' || status === 'persistent-action-needed';
}

function isProjectDomainCertificateTrustIssueStatus(
  status: ProjectDomainCertificateTrustStatus
) {
  return (
    status === 'date-invalid'
    || status === 'hostname-mismatch'
    || status === 'self-signed'
    || status === 'issuer-untrusted'
    || status === 'validation-failed'
  );
}

function isProjectDomainCertificatePathValidityIssueStatus(
  status: ProjectDomainCertificatePathValidityStatus
) {
  return status === 'expired' || status === 'not-yet-valid';
}

function isProjectDomainCertificatePathValidityWarningStatus(
  status: ProjectDomainCertificatePathValidityStatus
) {
  return status === 'expiring-soon';
}

const PROJECT_DOMAIN_CERTIFICATE_HISTORY_EVENT_KINDS = [
  'certificate_attention',
  'certificate_chain',
  'certificate_trust',
  'certificate_path_validity'
] as const satisfies readonly ProjectDomainCertificateHistoryEventKind[];

function isProjectDomainCertificateHistoryEventKind(
  kind: ProjectDomainEventKind
): kind is ProjectDomainCertificateHistoryEventKind {
  return (
    kind === 'certificate_attention'
    || kind === 'certificate_chain'
    || kind === 'certificate_trust'
    || kind === 'certificate_path_validity'
  );
}

function createEmptyProjectDomainCertificateHistorySummary(): ProjectDomainCertificateHistorySummaryRecord {
  return {
    eventCount: 0,
    incidentCount: 0,
    recoveryCount: 0,
    trustIncidentCount: 0,
    pathWarningCount: 0,
    pathIncidentCount: 0,
    chainIncidentCount: 0,
    attentionIncidentCount: 0,
    lastEventAt: null,
    lastIncidentAt: null,
    lastIncidentKind: null,
    lastRecoveryAt: null,
    lastRecoveryKind: null,
    lastPathWarningAt: null
  };
}

function isProjectDomainTrackedCertificatePathValidityStatus(
  status: ProjectDomainCertificatePathValidityStatus
) {
  return (
    isProjectDomainCertificatePathValidityIssueStatus(status)
    || isProjectDomainCertificatePathValidityWarningStatus(status)
  );
}

function recordProjectDomainCertificateHistoryIncident(
  summary: ProjectDomainCertificateHistorySummaryRecord,
  kind: ProjectDomainCertificateHistoryEventKind,
  occurredAt: Date
) {
  summary.incidentCount += 1;

  if (!summary.lastIncidentAt || occurredAt.getTime() > summary.lastIncidentAt.getTime()) {
    summary.lastIncidentAt = occurredAt;
    summary.lastIncidentKind = kind;
  }
}

function recordProjectDomainCertificateHistoryRecovery(
  summary: ProjectDomainCertificateHistorySummaryRecord,
  kind: ProjectDomainCertificateHistoryEventKind,
  occurredAt: Date
) {
  summary.recoveryCount += 1;

  if (!summary.lastRecoveryAt || occurredAt.getTime() > summary.lastRecoveryAt.getTime()) {
    summary.lastRecoveryAt = occurredAt;
    summary.lastRecoveryKind = kind;
  }
}

function createProjectDomainCertificateHistorySummary(
  events: readonly ProjectDomainEventRecord[]
): ProjectDomainCertificateHistorySummaryRecord {
  const summary = createEmptyProjectDomainCertificateHistorySummary();

  for (const event of events) {
    if (!isProjectDomainCertificateHistoryEventKind(event.kind)) {
      continue;
    }

    summary.eventCount += 1;

    if (!summary.lastEventAt || event.createdAt.getTime() > summary.lastEventAt.getTime()) {
      summary.lastEventAt = event.createdAt;
    }

    if (event.kind === 'certificate_attention') {
      const previousStatus = event.previousStatus as ProjectDomainCertificateAttentionStatus | null;
      const nextStatus = event.nextStatus as ProjectDomainCertificateAttentionStatus;

      if (isProjectDomainEscalatedCertificateAttentionStatus(nextStatus)) {
        summary.attentionIncidentCount += 1;
        recordProjectDomainCertificateHistoryIncident(summary, event.kind, event.createdAt);
        continue;
      }

      if (previousStatus && isProjectDomainEscalatedCertificateAttentionStatus(previousStatus)) {
        recordProjectDomainCertificateHistoryRecovery(summary, event.kind, event.createdAt);
      }

      continue;
    }

    if (event.kind === 'certificate_chain') {
      const previousStatus = event.previousStatus as ProjectDomainCertificateChainStatus | null;
      const nextStatus = event.nextStatus as ProjectDomainCertificateChainStatus;

      if (isProjectDomainCertificateChainIssueStatus(nextStatus)) {
        summary.chainIncidentCount += 1;
        recordProjectDomainCertificateHistoryIncident(summary, event.kind, event.createdAt);
        continue;
      }

      if (previousStatus && isProjectDomainCertificateChainIssueStatus(previousStatus) && nextStatus === 'chained') {
        recordProjectDomainCertificateHistoryRecovery(summary, event.kind, event.createdAt);
      }

      continue;
    }

    if (event.kind === 'certificate_trust') {
      const previousStatus = event.previousStatus as ProjectDomainCertificateTrustStatus | null;
      const nextStatus = event.nextStatus as ProjectDomainCertificateTrustStatus;

      if (isProjectDomainCertificateTrustIssueStatus(nextStatus)) {
        summary.trustIncidentCount += 1;
        recordProjectDomainCertificateHistoryIncident(summary, event.kind, event.createdAt);
        continue;
      }

      if (previousStatus && isProjectDomainCertificateTrustIssueStatus(previousStatus) && nextStatus === 'trusted') {
        recordProjectDomainCertificateHistoryRecovery(summary, event.kind, event.createdAt);
      }

      continue;
    }

    const previousStatus = event.previousStatus as ProjectDomainCertificatePathValidityStatus | null;
    const nextStatus = event.nextStatus as ProjectDomainCertificatePathValidityStatus;

    if (isProjectDomainCertificatePathValidityWarningStatus(nextStatus)) {
      summary.pathWarningCount += 1;

      if (!summary.lastPathWarningAt || event.createdAt.getTime() > summary.lastPathWarningAt.getTime()) {
        summary.lastPathWarningAt = event.createdAt;
      }
    }

    if (isProjectDomainCertificatePathValidityIssueStatus(nextStatus)) {
      summary.pathIncidentCount += 1;
      recordProjectDomainCertificateHistoryIncident(summary, event.kind, event.createdAt);
      continue;
    }

    if (
      previousStatus
      && isProjectDomainCertificatePathValidityIssueStatus(previousStatus)
      && (nextStatus === 'valid' || nextStatus === 'expiring-soon')
    ) {
      recordProjectDomainCertificateHistoryRecovery(summary, event.kind, event.createdAt);
    }
  }

  return summary;
}

function formatProjectDomainCertificateObservationCount(count: number) {
  return `${count} consecutive certificate check${count === 1 ? '' : 's'}`;
}

function createProjectDomainObservationDetailFromCount(input: {
  observedCount: number;
  changedAt: Date | null;
}) {
  if (input.observedCount <= 0) {
    return null;
  }

  const countDetail = `Observed across ${formatProjectDomainCertificateObservationCount(input.observedCount)}`;
  if (input.changedAt) {
    return `${countDetail} since ${formatProjectDomainCertificateTimestamp(input.changedAt)}.`;
  }

  return `${countDetail}.`;
}

function createProjectDomainCertificateObservationDetail(input: {
  certificateGuidanceObservedCount: number;
  certificateGuidanceChangedAt: Date | null;
}) {
  return createProjectDomainObservationDetailFromCount({
    observedCount: input.certificateGuidanceObservedCount,
    changedAt: input.certificateGuidanceChangedAt
  });
}

function resolveProjectDomainCertificateGuidanceTimeline(input: {
  previousGuidanceState: ProjectDomainCertificateGuidanceState | null;
  nextGuidanceState: ProjectDomainCertificateGuidanceState;
  previousChangedAt: Date | null;
  previousObservedCount: number;
  previousDiagnosticsCheckedAt: Date | null;
  checkedAt: Date;
}) {
  if (input.previousGuidanceState === input.nextGuidanceState) {
    const previousObservedCount =
      input.previousObservedCount > 0
        ? input.previousObservedCount
        : input.previousDiagnosticsCheckedAt
          ? 1
          : 0;

    return {
      certificateGuidanceChangedAt:
        input.previousChangedAt
        ?? input.previousDiagnosticsCheckedAt
        ?? input.checkedAt,
      certificateGuidanceObservedCount: Math.max(1, previousObservedCount + 1)
    };
  }

  return {
    certificateGuidanceChangedAt: input.checkedAt,
    certificateGuidanceObservedCount: 1
  };
}

function createProjectDomainCertificateValidity(input: {
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  evaluatedAt: Date;
  tlsStatus: ProjectDomainTlsStatus;
}) {
  if (!input.certificateValidFrom && !input.certificateValidTo) {
    return {
      certificateValidityStatus: 'unavailable' as const,
      certificateValidityDetail:
        input.tlsStatus === 'ready'
          ? 'The last HTTPS check succeeded, but the presented certificate validity window was not captured.'
          : 'Certificate validity dates have not been captured for this host yet.'
    };
  }

  if (input.certificateValidFrom && input.certificateValidFrom.getTime() > input.evaluatedAt.getTime()) {
    return {
      certificateValidityStatus: 'not-yet-valid' as const,
      certificateValidityDetail:
        `The presented certificate does not become valid until ${formatProjectDomainCertificateTimestamp(input.certificateValidFrom)}.`
    };
  }

  if (input.certificateValidTo && input.certificateValidTo.getTime() <= input.evaluatedAt.getTime()) {
    return {
      certificateValidityStatus: 'expired' as const,
      certificateValidityDetail:
        `The presented certificate expired at ${formatProjectDomainCertificateTimestamp(input.certificateValidTo)}.`
    };
  }

  if (
    input.certificateValidTo
    && input.certificateValidTo.getTime() - input.evaluatedAt.getTime() <= PROJECT_DOMAIN_CERTIFICATE_EXPIRING_SOON_MS
  ) {
    const daysRemaining = Math.max(
      1,
      Math.ceil((input.certificateValidTo.getTime() - input.evaluatedAt.getTime()) / (24 * 60 * 60 * 1000))
    );

    return {
      certificateValidityStatus: 'expiring-soon' as const,
      certificateValidityDetail:
        `The presented certificate remains valid until ${formatProjectDomainCertificateTimestamp(input.certificateValidTo)} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`
    };
  }

  return {
    certificateValidityStatus: 'valid' as const,
    certificateValidityDetail:
      input.certificateValidTo
        ? `The presented certificate is within its validity window until ${formatProjectDomainCertificateTimestamp(input.certificateValidTo)}.`
        : 'The presented certificate is currently within its validity window.'
  };
}

function createProjectDomainCertificateChainEntryLabel(input: {
  entries: readonly ProjectDomainCertificateChainEntry[];
  index: number;
}) {
  const entry = input.entries[input.index];
  const total = input.entries.length;
  const role =
    input.index === 0
      ? 'leaf certificate'
      : input.index === total - 1
        ? 'root certificate'
        : `intermediate certificate ${input.index}`;
  const subject = entry?.subjectName?.trim();

  return subject ? `${role} (${subject})` : role;
}

function createProjectDomainCertificateChainEntryValidity(input: {
  entry: ProjectDomainCertificateChainEntry;
  entries: readonly ProjectDomainCertificateChainEntry[];
  index: number;
  evaluatedAt: Date;
}) {
  const label = createProjectDomainCertificateChainEntryLabel({
    entries: input.entries,
    index: input.index
  });
  const validFrom = input.entry.validFrom ?? null;
  const validTo = input.entry.validTo ?? null;

  if (!validFrom && !validTo) {
    return {
      certificatePathValidityStatus: 'unavailable' as const,
      certificatePathValidityDetail:
        `The ${label} did not include a recorded validity window during the latest TLS inspection.`
    };
  }

  if (validFrom && validFrom.getTime() > input.evaluatedAt.getTime()) {
    return {
      certificatePathValidityStatus: 'not-yet-valid' as const,
      certificatePathValidityDetail:
        `The ${label} does not become valid until ${formatProjectDomainCertificateTimestamp(validFrom)}.`
    };
  }

  if (validTo && validTo.getTime() <= input.evaluatedAt.getTime()) {
    return {
      certificatePathValidityStatus: 'expired' as const,
      certificatePathValidityDetail:
        `The ${label} expired at ${formatProjectDomainCertificateTimestamp(validTo)}.`
    };
  }

  if (
    validTo
    && validTo.getTime() - input.evaluatedAt.getTime() <= PROJECT_DOMAIN_CERTIFICATE_EXPIRING_SOON_MS
  ) {
    const daysRemaining = Math.max(
      1,
      Math.ceil((validTo.getTime() - input.evaluatedAt.getTime()) / (24 * 60 * 60 * 1000))
    );

    return {
      certificatePathValidityStatus: 'expiring-soon' as const,
      certificatePathValidityDetail:
        `The ${label} remains valid until ${formatProjectDomainCertificateTimestamp(validTo)} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`
    };
  }

  return {
    certificatePathValidityStatus: 'valid' as const,
    certificatePathValidityDetail:
      validTo
        ? `The ${label} is currently within its validity window until ${formatProjectDomainCertificateTimestamp(validTo)}.`
        : `The ${label} is currently within its recorded validity window.`
  };
}

function createProjectDomainCertificatePathValidity(input: {
  certificateChainEntries: readonly ProjectDomainCertificateChainEntry[];
  evaluatedAt: Date;
}) {
  if (input.certificateChainEntries.length === 0) {
    return {
      certificatePathValidityStatus: 'unavailable' as const,
      certificatePathValidityTitle: 'Issuer-path validity unavailable',
      certificatePathValidityDetail:
        'The control plane has not captured a full presented issuer path with per-certificate validity windows for this host yet.'
    };
  }

  const entryValidity = input.certificateChainEntries.map((entry, index) => ({
    ...createProjectDomainCertificateChainEntryValidity({
      entry,
      entries: input.certificateChainEntries,
      index,
      evaluatedAt: input.evaluatedAt
    }),
    index
  }));
  const unavailableCount = entryValidity.filter(
    (entry) => entry.certificatePathValidityStatus === 'unavailable'
  ).length;
  const unavailableDetail =
    unavailableCount > 0
      ? ` ${unavailableCount} certificate entr${unavailableCount === 1 ? 'y is' : 'ies are'} missing validity-window metadata.`
      : '';
  const expiredEntry = entryValidity.find(
    (entry) => entry.certificatePathValidityStatus === 'expired'
  );
  if (expiredEntry) {
    return {
      certificatePathValidityStatus: 'expired' as const,
      certificatePathValidityTitle: 'Presented issuer path includes an expired certificate',
      certificatePathValidityDetail:
        `${expiredEntry.certificatePathValidityDetail}${unavailableDetail}`.trim()
    };
  }

  const notYetValidEntry = entryValidity.find(
    (entry) => entry.certificatePathValidityStatus === 'not-yet-valid'
  );
  if (notYetValidEntry) {
    return {
      certificatePathValidityStatus: 'not-yet-valid' as const,
      certificatePathValidityTitle: 'Presented issuer path includes a certificate that is not valid yet',
      certificatePathValidityDetail:
        `${notYetValidEntry.certificatePathValidityDetail}${unavailableDetail}`.trim()
    };
  }

  const expiringSoonEntries = entryValidity.filter(
    (entry) => entry.certificatePathValidityStatus === 'expiring-soon'
  );
  if (expiringSoonEntries.length > 0) {
    const primaryEntry = expiringSoonEntries[0];
    const additionalCount = expiringSoonEntries.length - 1;
    return {
      certificatePathValidityStatus: 'expiring-soon' as const,
      certificatePathValidityTitle: 'Presented issuer path includes a certificate nearing expiry',
      certificatePathValidityDetail:
        `${primaryEntry.certificatePathValidityDetail}${additionalCount > 0 ? ` ${additionalCount} additional certificate entr${additionalCount === 1 ? 'y is' : 'ies are'} also nearing expiry.` : ''}${unavailableDetail}`.trim()
    };
  }

  const validCount = entryValidity.filter(
    (entry) => entry.certificatePathValidityStatus === 'valid'
  ).length;
  if (validCount > 0) {
    return {
      certificatePathValidityStatus: 'valid' as const,
      certificatePathValidityTitle: 'Presented issuer path is within its recorded validity windows',
      certificatePathValidityDetail:
        `All presented certificates with recorded validity windows are currently in-date.${unavailableDetail}`.trim()
    };
  }

  return {
    certificatePathValidityStatus: 'unavailable' as const,
    certificatePathValidityTitle: 'Issuer-path validity unavailable',
    certificatePathValidityDetail:
      `The latest issuer-path snapshot did not include enough validity-window data to assess the full chain.${unavailableDetail}`.trim()
  };
}

function resolveProjectDomainCertificatePathValidityTimeline(input: {
  previousPathValidityStatus: ProjectDomainCertificatePathValidityStatus | null;
  nextPathValidityStatus: ProjectDomainCertificatePathValidityStatus;
  previousChangedAt: Date | null;
  previousObservedCount: number;
  previousLastHealthyAt: Date | null;
  previousDiagnosticsCheckedAt: Date | null;
  checkedAt: Date;
}) {
  if (input.previousPathValidityStatus === input.nextPathValidityStatus) {
    const previousObservedCount =
      input.previousObservedCount > 0
        ? input.previousObservedCount
        : input.previousDiagnosticsCheckedAt
          ? 1
          : 0;
    const changedAt =
      input.previousChangedAt
      ?? input.previousDiagnosticsCheckedAt
      ?? input.checkedAt;

    return {
      certificatePathValidityChangedAt: changedAt,
      certificatePathValidityObservedCount: Math.max(1, previousObservedCount + 1),
      certificatePathValidityLastHealthyAt:
        input.nextPathValidityStatus === 'valid'
          ? input.previousLastHealthyAt ?? changedAt
          : input.previousLastHealthyAt ?? null
    };
  }

  return {
    certificatePathValidityChangedAt: input.checkedAt,
    certificatePathValidityObservedCount: 1,
    certificatePathValidityLastHealthyAt:
      input.nextPathValidityStatus === 'valid'
        ? input.checkedAt
        : input.previousLastHealthyAt ?? null
  };
}

function formatProjectDomainCertificateNames(names: readonly string[]) {
  if (names.length === 0) {
    return null;
  }

  if (names.length <= 3) {
    return names.join(', ');
  }

  return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
}

function formatProjectDomainCertificateChain(subjects: readonly string[]) {
  if (subjects.length === 0) {
    return null;
  }

  if (subjects.length <= 4) {
    return subjects.join(' -> ');
  }

  return `${subjects.slice(0, 4).join(' -> ')} (+${subjects.length - 4} more)`;
}

function createProjectDomainCertificateChainEntriesFromSubjects(subjects: readonly string[]) {
  return subjects
    .filter((entry) => entry.trim().length > 0)
    .map((subjectName) => ({
      subjectName,
      issuerName: null,
      fingerprintSha256: null,
      serialNumber: null,
      isSelfIssued: false,
      validFrom: null,
      validTo: null
    })) satisfies ProjectDomainCertificateChainEntry[];
}

function normalizeProjectDomainCertificateChainEntries(input: {
  certificateChainEntries: readonly ProjectDomainCertificateChainEntry[];
  certificateChainSubjects: readonly string[];
}) {
  if (input.certificateChainEntries.length > 0) {
    return input.certificateChainEntries
      .filter((entry) =>
        Boolean(
          (entry.subjectName && entry.subjectName.trim().length > 0)
          || (entry.issuerName && entry.issuerName.trim().length > 0)
          || entry.fingerprintSha256
          || entry.serialNumber
          || entry.validFrom
          || entry.validTo
        )
      )
      .map((entry) => ({
        subjectName: entry.subjectName ?? null,
        issuerName: entry.issuerName ?? null,
        fingerprintSha256: entry.fingerprintSha256 ?? null,
        serialNumber: entry.serialNumber ?? null,
        isSelfIssued: Boolean(entry.isSelfIssued),
        validFrom: entry.validFrom ?? null,
        validTo: entry.validTo ?? null
      })) satisfies ProjectDomainCertificateChainEntry[];
  }

  return createProjectDomainCertificateChainEntriesFromSubjects(input.certificateChainSubjects);
}

function certificateChainEntriesMatch(
  left: readonly ProjectDomainCertificateChainEntry[],
  right: readonly ProjectDomainCertificateChainEntry[]
) {
  return left.length === right.length
    && left.every((entry, index) => {
      const other = right[index];
      return Boolean(other)
        && entry.subjectName === other.subjectName
        && entry.issuerName === other.issuerName
        && entry.fingerprintSha256 === other.fingerprintSha256
        && entry.serialNumber === other.serialNumber
        && entry.isSelfIssued === other.isSelfIssued
        && timestampsMatch(entry.validFrom ?? null, other.validFrom ?? null)
        && timestampsMatch(entry.validTo ?? null, other.validTo ?? null);
    });
}

function createProjectDomainCertificateChainRoles(entries: readonly ProjectDomainCertificateChainEntry[]) {
  const normalizedSubjects = entries
    .map((entry) => entry.subjectName)
    .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  return {
    certificateChainDepth: normalizedSubjects.length,
    certificateIntermediateSubjectNames:
      normalizedSubjects.length > 2
        ? normalizedSubjects.slice(1, -1)
        : []
  };
}

function isProjectDomainHealthyCertificateChainStatus(status: ProjectDomainCertificateChainStatus) {
  return status === 'chained';
}

function isProjectDomainCertificateChainMonitorStatus(status: ProjectDomainCertificateChainStatus) {
  return status === 'leaf-only' || status === 'unavailable';
}

function isProjectDomainCertificateChainIssueStatus(status: ProjectDomainCertificateChainStatus) {
  return status === 'incomplete' || status === 'private-root' || status === 'self-signed-leaf';
}

function createProjectDomainCertificateChain(input: {
  certificateChainEntries: readonly ProjectDomainCertificateChainEntry[];
  certificateChainSubjects: string[];
  certificateRootSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateTrustStatus: ProjectDomainCertificateTrustStatus;
}) {
  const chain = input.certificateChainSubjects.filter((entry) => entry.trim().length > 0);
  const normalizedEntries = normalizeProjectDomainCertificateChainEntries({
    certificateChainEntries: input.certificateChainEntries,
    certificateChainSubjects: chain
  });
  const chainRoles = createProjectDomainCertificateChainRoles(normalizedEntries);
  const chainDetail = formatProjectDomainCertificateChain(chain);
  const intermediateDetail = chainRoles.certificateIntermediateSubjectNames.length > 0
    ? ` Intermediates: ${formatProjectDomainCertificateNames(chainRoles.certificateIntermediateSubjectNames)}.`
    : '';
  const rootDetail = input.certificateRootSubjectName
    ? ` Root: ${input.certificateRootSubjectName}.`
    : '';
  const issuerDetail = input.certificateIssuerName
    ? ` Leaf issuer: ${input.certificateIssuerName}.`
    : '';

  if (chain.length === 0) {
    return {
      certificateChainEntries: normalizedEntries,
      ...chainRoles,
      certificateChainStatus: 'unavailable' as const,
      certificateChainTitle: 'Certificate chain unavailable',
      certificateChainDetail:
        'The latest checks did not capture a presented certificate chain summary for this host yet.'
    };
  }

  if (chain.length === 1) {
    if (input.certificateTrustStatus === 'self-signed') {
      return {
        certificateChainEntries: normalizedEntries,
        ...chainRoles,
        certificateChainStatus: 'self-signed-leaf' as const,
        certificateChainTitle: 'Self-signed leaf certificate',
        certificateChainDetail:
          `Only one certificate was observed in the presented chain and it appears to be self-signed. ${chainDetail ? `Observed chain: ${chainDetail}.` : ''}`.trim()
      };
    }

    if (
      input.certificateTrustStatus === 'issuer-untrusted'
      || input.certificateTrustStatus === 'validation-failed'
    ) {
      return {
        certificateChainEntries: normalizedEntries,
        ...chainRoles,
        certificateChainStatus: 'incomplete' as const,
        certificateChainTitle: 'Presented chain may be incomplete',
        certificateChainDetail:
          `Only the leaf certificate was observed during TLS inspection, which may indicate a missing intermediate or an untrusted issuer.${issuerDetail}`.trim()
      };
    }

    return {
      certificateChainEntries: normalizedEntries,
      ...chainRoles,
      certificateChainStatus: 'leaf-only' as const,
      certificateChainTitle: 'Leaf certificate observed',
      certificateChainDetail:
        `Only the leaf certificate was observed during TLS inspection. ${chainDetail ? `Observed chain: ${chainDetail}.` : ''}`.trim()
    };
  }

  if (
    input.certificateTrustStatus === 'issuer-untrusted'
    || input.certificateTrustStatus === 'self-signed'
  ) {
    return {
      certificateChainEntries: normalizedEntries,
      ...chainRoles,
      certificateChainStatus: 'private-root' as const,
      certificateChainTitle: 'Chain ends at an untrusted root',
      certificateChainDetail:
        `The presented chain includes multiple certificates, but clients still do not trust the terminating issuer.${rootDetail}${intermediateDetail}${chainDetail ? ` Observed chain: ${chainDetail}.` : ''}`.trim()
    };
  }

  return {
    certificateChainEntries: normalizedEntries,
    ...chainRoles,
    certificateChainStatus: 'chained' as const,
    certificateChainTitle: 'Presented chain captured',
    certificateChainDetail:
      `The presented certificate chain includes ${chain.length} certificates.${rootDetail}${intermediateDetail}${chainDetail ? ` Observed chain: ${chainDetail}.` : ''}`.trim()
  };
}

function resolveProjectDomainCertificateChainTimeline(input: {
  previousChainStatus: ProjectDomainCertificateChainStatus | null;
  nextChainStatus: ProjectDomainCertificateChainStatus;
  nextChainEntries: readonly ProjectDomainCertificateChainEntry[];
  previousChangedAt: Date | null;
  previousObservedCount: number;
  previousLastHealthyAt: Date | null;
  previousLastHealthyChainEntries: readonly ProjectDomainCertificateChainEntry[];
  previousDiagnosticsCheckedAt: Date | null;
  checkedAt: Date;
}) {
  const nextLastHealthyChainEntries =
    isProjectDomainHealthyCertificateChainStatus(input.nextChainStatus) && input.nextChainEntries.length > 0
      ? input.nextChainEntries.map((entry) => ({ ...entry }))
      : input.previousLastHealthyChainEntries.map((entry) => ({ ...entry }));

  if (input.previousChainStatus === input.nextChainStatus) {
    const previousObservedCount =
      input.previousObservedCount > 0
        ? input.previousObservedCount
        : input.previousDiagnosticsCheckedAt
          ? 1
          : 0;
    const changedAt =
      input.previousChangedAt
      ?? input.previousDiagnosticsCheckedAt
      ?? input.checkedAt;

    return {
      certificateChainChangedAt: changedAt,
      certificateChainObservedCount: Math.max(1, previousObservedCount + 1),
      certificateChainLastHealthyAt:
        isProjectDomainHealthyCertificateChainStatus(input.nextChainStatus)
          ? input.previousLastHealthyAt ?? changedAt
          : input.previousLastHealthyAt ?? null,
      certificateLastHealthyChainEntries: nextLastHealthyChainEntries
    };
  }

  return {
    certificateChainChangedAt: input.checkedAt,
    certificateChainObservedCount: 1,
    certificateChainLastHealthyAt:
      isProjectDomainHealthyCertificateChainStatus(input.nextChainStatus)
        ? input.checkedAt
        : input.previousLastHealthyAt ?? null,
    certificateLastHealthyChainEntries: nextLastHealthyChainEntries
  };
}

function createProjectDomainCertificateChainAttention(input: {
  certificateChainStatus: ProjectDomainCertificateChainStatus;
  certificateChainTitle: string;
  certificateChainDetail: string;
  certificateChainChangedAt: Date | null;
  certificateChainObservedCount: number;
  certificateChainLastHealthyAt: Date | null;
  diagnosticsCheckedAt: Date | null;
}) {
  const observationDetail = createProjectDomainObservationDetailFromCount({
    observedCount: input.certificateChainObservedCount,
    changedAt: input.certificateChainChangedAt
  });
  const lastHealthyDetail = input.certificateChainLastHealthyAt
    && !timestampsMatch(input.certificateChainLastHealthyAt, input.diagnosticsCheckedAt)
    ? ` Last fully chained certificate path was confirmed at ${formatProjectDomainCertificateTimestamp(input.certificateChainLastHealthyAt)}.`
    : '';

  if (isProjectDomainHealthyCertificateChainStatus(input.certificateChainStatus)) {
    return {
      certificateChainAttentionStatus: 'healthy' as const,
      certificateChainAttentionTitle: 'Presented chain looks healthy',
      certificateChainAttentionDetail:
        `${input.certificateChainDetail}${observationDetail ? ` ${observationDetail}` : ''}`.trim()
    };
  }

  if (isProjectDomainCertificateChainMonitorStatus(input.certificateChainStatus)) {
    return {
      certificateChainAttentionStatus: 'monitor' as const,
      certificateChainAttentionTitle:
        input.certificateChainStatus === 'leaf-only'
          ? 'Monitor presented chain depth'
          : 'Monitor chain capture',
      certificateChainAttentionDetail:
        `${input.certificateChainDetail}${observationDetail ? ` ${observationDetail}` : ''}`.trim()
    };
  }

  if (isProjectDomainCertificateChainIssueStatus(input.certificateChainStatus)) {
    const isPersistent =
      input.certificateChainObservedCount >= PROJECT_DOMAIN_CERTIFICATE_PERSISTENT_ATTENTION_OBSERVATIONS;

    return {
      certificateChainAttentionStatus:
        isPersistent
          ? 'persistent-action-needed' as const
          : 'action-needed' as const,
      certificateChainAttentionTitle:
        isPersistent
          ? 'Persistent certificate chain issue'
          : 'Certificate chain needs action',
      certificateChainAttentionDetail:
        `${input.certificateChainDetail}${observationDetail ? ` ${observationDetail}` : ''}${lastHealthyDetail}`.trim()
    };
  }

  return {
    certificateChainAttentionStatus: 'monitor' as const,
    certificateChainAttentionTitle: input.certificateChainTitle,
    certificateChainAttentionDetail:
      `${input.certificateChainDetail}${observationDetail ? ` ${observationDetail}` : ''}`.trim()
  };
}

function createProjectDomainCertificateChainHistory(input: {
  certificateChainEntries: readonly ProjectDomainCertificateChainEntry[];
  certificateChainStatus: ProjectDomainCertificateChainStatus;
  certificateLastHealthyChainEntries: readonly ProjectDomainCertificateChainEntry[];
  certificateChainLastHealthyAt: Date | null;
}) {
  const currentEntries = input.certificateChainEntries;
  const lastHealthyEntries = input.certificateLastHealthyChainEntries;
  const currentChain = formatProjectDomainCertificateChain(
    currentEntries
      .map((entry) => entry.subjectName)
      .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0))
  );
  const lastHealthyChain = formatProjectDomainCertificateChain(
    lastHealthyEntries
      .map((entry) => entry.subjectName)
      .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0))
  );
  const lastHealthyAtDetail = input.certificateChainLastHealthyAt
    ? ` Last fully healthy chain was recorded at ${formatProjectDomainCertificateTimestamp(input.certificateChainLastHealthyAt)}.`
    : '';

  if (currentEntries.length === 0 && lastHealthyEntries.length === 0) {
    return {
      certificateChainHistoryStatus: 'unavailable' as const,
      certificateChainHistoryTitle: 'No chain history recorded yet',
      certificateChainHistoryDetail:
        'The control plane has not captured enough presented-certificate history to compare this host against a previous healthy chain yet.'
    };
  }

  if (lastHealthyEntries.length === 0) {
    return {
      certificateChainHistoryStatus: 'baseline-missing' as const,
      certificateChainHistoryTitle: 'Healthy chain baseline not recorded yet',
      certificateChainHistoryDetail:
        `${currentChain ? `Current presented chain: ${currentChain}. ` : ''}A last-known-healthy chain has not been captured for this host yet, so issuer-path drift cannot be compared historically.`.trim()
    };
  }

  if (certificateChainEntriesMatch(currentEntries, lastHealthyEntries)) {
    if (isProjectDomainHealthyCertificateChainStatus(input.certificateChainStatus)) {
      return {
        certificateChainHistoryStatus: 'stable' as const,
        certificateChainHistoryTitle: 'Healthy chain matches the last known-good path',
        certificateChainHistoryDetail:
          `${currentChain ? `The current presented chain still matches the last known-good chain (${currentChain}).` : 'The current presented chain still matches the last known-good path.'}${lastHealthyAtDetail}`.trim()
      };
    }

    return {
      certificateChainHistoryStatus: 'degraded' as const,
      certificateChainHistoryTitle: 'Known chain has regressed',
      certificateChainHistoryDetail:
        `${currentChain ? `The current presented chain still matches the last known-good path (${currentChain}), but its health classification has regressed.` : 'The current presented chain still matches the last known-good path, but its health classification has regressed.'}${lastHealthyAtDetail}`.trim()
    };
  }

  if (isProjectDomainHealthyCertificateChainStatus(input.certificateChainStatus)) {
    return {
      certificateChainHistoryStatus: 'rotated' as const,
      certificateChainHistoryTitle: 'Healthy issuer path changed',
      certificateChainHistoryDetail:
        `${currentChain ? `The current healthy chain is now ${currentChain}. ` : ''}${lastHealthyChain ? `The previous healthy chain was ${lastHealthyChain}.` : 'The previous healthy chain differed from what is currently being served.'}`.trim()
    };
  }

  return {
    certificateChainHistoryStatus: 'drifted' as const,
    certificateChainHistoryTitle: 'Current chain drifted from the last healthy path',
    certificateChainHistoryDetail:
      `${currentChain ? `The current presented chain is ${currentChain}. ` : ''}${lastHealthyChain ? `The last healthy chain was ${lastHealthyChain}.` : 'The current presented chain no longer matches the last healthy chain recorded for this host.'}${lastHealthyAtDetail}`.trim()
  };
}

function createProjectDomainCertificateTrust(input: {
  tlsStatus: ProjectDomainTlsStatus;
  certificateValidityStatus: ProjectDomainCertificateValidityStatus;
  certificateValidFrom: Date | null;
  certificateValidTo: Date | null;
  certificateValidationReason: ProjectDomainCertificateValidationReason | null;
  certificateSubjectName: string | null;
  certificateIssuerName: string | null;
  certificateSubjectAltNames: string[];
}) {
  const issuerDetail = input.certificateIssuerName
    ? ` Current issuer: ${input.certificateIssuerName}.`
    : '';
  const subjectAltNames = formatProjectDomainCertificateNames(input.certificateSubjectAltNames);
  const coverageDetail = subjectAltNames
    ? ` Observed certificate coverage: ${subjectAltNames}.`
    : input.certificateSubjectName
      ? ` Observed certificate subject: ${input.certificateSubjectName}.`
      : '';

  if (input.tlsStatus === 'ready' && !input.certificateValidationReason) {
    return {
      certificateTrustStatus: 'trusted' as const,
      certificateTrustDetail:
        `The current certificate validated successfully for this host.${issuerDetail}${coverageDetail}`.trim()
    };
  }

  if (
    !input.certificateValidationReason
    && (
      input.certificateValidityStatus === 'expired'
      || input.certificateValidityStatus === 'not-yet-valid'
    )
  ) {
    return {
      certificateTrustStatus: 'date-invalid' as const,
      certificateTrustDetail:
        input.certificateValidityStatus === 'expired'
          ? `The served certificate is outside its validity window and is already expired.${issuerDetail}`
          : `The served certificate is not valid yet for the current time.${issuerDetail}`
    };
  }

  switch (input.certificateValidationReason) {
    case 'expired':
    case 'not-yet-valid':
      return {
        certificateTrustStatus: 'date-invalid' as const,
        certificateTrustDetail:
          input.certificateValidationReason === 'expired'
            ? `The served certificate is outside its validity window and is already expired.${issuerDetail}`
            : `The served certificate is not valid yet for the current time.${issuerDetail}`
      };
    case 'hostname-mismatch':
      return {
        certificateTrustStatus: 'hostname-mismatch' as const,
        certificateTrustDetail:
          `The served certificate does not appear to cover this hostname.${coverageDetail}${issuerDetail}`.trim()
      };
    case 'self-signed':
      return {
        certificateTrustStatus: 'self-signed' as const,
        certificateTrustDetail:
          `The served certificate chain is self-signed and will not validate for normal clients without custom trust configuration.${issuerDetail}`.trim()
      };
    case 'issuer-untrusted':
      return {
        certificateTrustStatus: 'issuer-untrusted' as const,
        certificateTrustDetail:
          `The served certificate chain could not be linked to a trusted issuer.${issuerDetail}`.trim()
      };
    case 'validation-failed':
      return {
        certificateTrustStatus: 'validation-failed' as const,
        certificateTrustDetail:
          `The served certificate failed validation, but the exact trust issue could not be classified automatically.${issuerDetail}${coverageDetail}`.trim()
      };
    default:
      if (input.certificateValidFrom || input.certificateValidTo || input.certificateIssuerName || input.certificateSubjectName) {
        return {
          certificateTrustStatus: 'unavailable' as const,
          certificateTrustDetail:
            `Certificate metadata was captured, but the control plane could not determine a stable trust classification for it.${issuerDetail}${coverageDetail}`.trim()
        };
      }

      return {
        certificateTrustStatus: 'unavailable' as const,
        certificateTrustDetail: 'Certificate trust details have not been captured for this host yet.'
      };
  }
}

function resolveProjectDomainCertificateIdentityTimeline(input: {
  previousFingerprintSha256: string | null;
  nextFingerprintSha256: string | null;
  previousFirstObservedAt: Date | null;
  previousChangedAt: Date | null;
  previousLastRotatedAt: Date | null;
  checkedAt: Date;
}) {
  if (!input.nextFingerprintSha256) {
    return {
      certificateFirstObservedAt: input.previousFirstObservedAt ?? null,
      certificateChangedAt: input.previousChangedAt ?? null,
      certificateLastRotatedAt: input.previousLastRotatedAt ?? null
    };
  }

  if (!input.previousFingerprintSha256) {
    return {
      certificateFirstObservedAt: input.previousFirstObservedAt ?? input.checkedAt,
      certificateChangedAt:
        input.previousChangedAt
        ?? (input.previousFirstObservedAt ? null : input.checkedAt),
      certificateLastRotatedAt: input.previousLastRotatedAt ?? null
    };
  }

  if (input.previousFingerprintSha256 === input.nextFingerprintSha256) {
    return {
      certificateFirstObservedAt: input.previousFirstObservedAt ?? input.checkedAt,
      certificateChangedAt: input.previousChangedAt ?? null,
      certificateLastRotatedAt: input.previousLastRotatedAt ?? null
    };
  }

  return {
    certificateFirstObservedAt: input.previousFirstObservedAt ?? input.checkedAt,
    certificateChangedAt: input.checkedAt,
    certificateLastRotatedAt: input.checkedAt
  };
}

function createProjectDomainCertificateIdentity(input: {
  certificateFingerprintSha256: string | null;
  certificateSerialNumber: string | null;
  certificateFirstObservedAt: Date | null;
  certificateChangedAt: Date | null;
  certificateLastRotatedAt: Date | null;
  diagnosticsCheckedAt: Date | null;
  tlsStatus: ProjectDomainTlsStatus;
  certificateTrustStatus: ProjectDomainCertificateTrustStatus;
}) {
  if (!input.certificateFingerprintSha256 && !input.certificateSerialNumber) {
    return {
      certificateIdentityStatus: 'unavailable' as const,
      certificateIdentityTitle: 'Certificate identity unavailable',
      certificateIdentityDetail:
        'The latest checks did not capture a presented certificate fingerprint or serial number for this host yet.'
    };
  }

  const fingerprintDetail = input.certificateFingerprintSha256
    ? ` Fingerprint: ${formatProjectDomainCertificateFingerprintPreview(input.certificateFingerprintSha256)}.`
    : '';
  const serialDetail = input.certificateSerialNumber
    ? ` Serial: ${input.certificateSerialNumber}.`
    : '';

  if (timestampsMatch(input.certificateFirstObservedAt, input.diagnosticsCheckedAt)) {
    return {
      certificateIdentityStatus: 'first-observed' as const,
      certificateIdentityTitle: 'Certificate identity first observed',
      certificateIdentityDetail:
        `The current certificate identity was captured for this host on the latest check.${fingerprintDetail}${serialDetail}`.trim()
    };
  }

  if (
    timestampsMatch(input.certificateChangedAt, input.diagnosticsCheckedAt)
    && !timestampsMatch(input.certificateFirstObservedAt, input.diagnosticsCheckedAt)
  ) {
    if (input.tlsStatus === 'ready' && input.certificateTrustStatus === 'trusted') {
      return {
        certificateIdentityStatus: 'rotated' as const,
        certificateIdentityTitle: 'Certificate rotated cleanly',
        certificateIdentityDetail:
          `A different certificate was observed on the latest check and it currently validates successfully for this host.${fingerprintDetail}${serialDetail}`.trim()
      };
    }

    return {
      certificateIdentityStatus: 'rotated-attention' as const,
      certificateIdentityTitle: 'Certificate changed and needs review',
      certificateIdentityDetail:
        `A different certificate was observed on the latest check, but the newly served certificate still has trust or validity issues.${fingerprintDetail}${serialDetail}`.trim()
    };
  }

  if (input.certificateLastRotatedAt) {
    return {
      certificateIdentityStatus: 'stable' as const,
      certificateIdentityTitle: 'Certificate identity stable',
      certificateIdentityDetail:
        `The currently observed certificate identity has remained stable since the last recorded rotation at ${formatProjectDomainCertificateTimestamp(input.certificateLastRotatedAt)}.${fingerprintDetail}${serialDetail}`.trim()
    };
  }

  return {
    certificateIdentityStatus: 'stable' as const,
    certificateIdentityTitle: 'Certificate identity stable',
    certificateIdentityDetail:
      input.certificateFirstObservedAt
        ? `The currently observed certificate identity has remained stable since it was first recorded at ${formatProjectDomainCertificateTimestamp(input.certificateFirstObservedAt)}.${fingerprintDetail}${serialDetail}`.trim()
        : `The currently observed certificate identity is stable.${fingerprintDetail}${serialDetail}`.trim()
  };
}

function createProjectDomainCertificateGuidance(input: {
  routeStatus: ProjectDomainStatusRecord['routeStatus'];
  ownershipStatus: ProjectDomainOwnershipStatus;
  tlsStatus: ProjectDomainTlsStatus;
  tlsReadyAt: Date | null;
  certificateValidityStatus: ProjectDomainCertificateValidityStatus;
  certificatePathValidityStatus: ProjectDomainCertificatePathValidityStatus;
  certificatePathValidityDetail: string;
  certificateTrustStatus: ProjectDomainCertificateTrustStatus;
}) {
  if (input.routeStatus === 'pending' || input.routeStatus === 'stale') {
    return {
      certificateGuidanceState: 'wait-for-route' as const,
      certificateGuidanceTitle:
        input.routeStatus === 'pending'
          ? 'Publish a live route first'
          : 'Restore a live route first',
      certificateGuidanceDetail:
        input.routeStatus === 'pending'
          ? 'Certificate issuance and renewal checks only become meaningful after this host is attached to a live public route.'
          : 'Certificate state should be reviewed again after this host is attached to a live public route instead of a stale deployment.'
    };
  }

  if (input.ownershipStatus === 'pending' || input.ownershipStatus === 'mismatch') {
    return {
      certificateGuidanceState: 'wait-for-dns' as const,
      certificateGuidanceTitle:
        input.ownershipStatus === 'pending'
          ? 'Finish routing DNS'
          : 'Fix routing DNS',
      certificateGuidanceDetail:
        input.ownershipStatus === 'pending'
          ? 'Certificate issuance will not complete until routing DNS points this host at the platform target.'
          : 'Certificate validation and renewal stay blocked while routing DNS points away from the platform target.'
    };
  }

  if (input.certificateValidityStatus === 'expired' || input.certificateValidityStatus === 'not-yet-valid') {
    return {
      certificateGuidanceState: 'renew-now' as const,
      certificateGuidanceTitle:
        input.certificateValidityStatus === 'expired'
          ? 'Renew or replace the certificate now'
          : 'Review certificate issuance timing',
      certificateGuidanceDetail:
        input.certificateValidityStatus === 'expired'
          ? 'The currently served certificate is already expired. Confirm renewal or replace the served certificate before clients lose HTTPS trust.'
          : 'The currently served certificate is not valid yet. Review the issuance flow and the certificate currently being presented for this host.'
    };
  }

  if (
    input.certificatePathValidityStatus === 'expired'
    || input.certificatePathValidityStatus === 'not-yet-valid'
  ) {
    return {
      certificateGuidanceState: 'renew-now' as const,
      certificateGuidanceTitle:
        input.certificatePathValidityStatus === 'expired'
          ? 'Replace the served issuer path now'
          : 'Review issuer-path issuance timing',
      certificateGuidanceDetail:
        input.certificatePathValidityStatus === 'expired'
          ? `${input.certificatePathValidityDetail} Renew or replace the affected certificate path before clients start rejecting the served chain.`
          : `${input.certificatePathValidityDetail} Review the issuer path currently being served for this host before clients try to validate it.`
    };
  }

  if (input.certificateValidityStatus === 'expiring-soon') {
    return {
      certificateGuidanceState: 'renew-soon' as const,
      certificateGuidanceTitle: 'Schedule certificate renewal',
      certificateGuidanceDetail:
        'The current certificate is nearing expiry. Confirm the renewal path before the validity window closes.'
    };
  }

  if (input.certificatePathValidityStatus === 'expiring-soon') {
    return {
      certificateGuidanceState: 'renew-soon' as const,
      certificateGuidanceTitle: 'Plan issuer-path renewal',
      certificateGuidanceDetail:
        `${input.certificatePathValidityDetail} Confirm that the full presented issuer path will refresh before clients start rejecting it.`
    };
  }

  if (input.certificateTrustStatus === 'hostname-mismatch') {
    return {
      certificateGuidanceState: 'fix-coverage' as const,
      certificateGuidanceTitle: 'Serve a certificate for this host',
      certificateGuidanceDetail:
        'The currently presented certificate does not appear to cover this hostname. Review the served certificate coverage and the live route target.'
    };
  }

  if (
    input.certificateTrustStatus === 'self-signed'
    || input.certificateTrustStatus === 'issuer-untrusted'
    || input.certificateTrustStatus === 'validation-failed'
  ) {
    return {
      certificateGuidanceState: 'fix-trust' as const,
      certificateGuidanceTitle: 'Review certificate trust chain',
      certificateGuidanceDetail:
        'The current certificate is being served, but clients are unlikely to trust it yet. Review the issuer chain and the certificate the route is presenting.'
    };
  }

  if (input.tlsStatus === 'pending') {
    return {
      certificateGuidanceState: 'wait-for-issuance' as const,
      certificateGuidanceTitle:
        input.tlsReadyAt
          ? 'Wait for renewal to settle'
          : 'Wait for initial issuance',
      certificateGuidanceDetail:
        input.tlsReadyAt
          ? 'This host previously had healthy HTTPS. Refresh checks again shortly to confirm whether renewal or propagation has settled.'
          : 'DNS and routing look ready, but HTTPS is still provisioning or propagating. Refresh checks again shortly.'
    };
  }

  if (input.tlsStatus === 'unknown' || input.certificateTrustStatus === 'unavailable') {
    return {
      certificateGuidanceState: 'refresh-checks' as const,
      certificateGuidanceTitle: 'Retry certificate checks',
      certificateGuidanceDetail:
        'The control plane could not classify the current certificate state confidently. Refresh checks after confirming the host is reachable from the public internet.'
    };
  }

  return {
    certificateGuidanceState: 'healthy' as const,
    certificateGuidanceTitle: 'Certificate healthy',
    certificateGuidanceDetail:
      'The current certificate looks healthy for this host, and no immediate certificate action is recommended.'
  };
}

function createProjectDomainCertificateAttention(input: {
  certificateGuidanceState: ProjectDomainCertificateGuidanceState;
  certificateGuidanceTitle: string;
  certificateGuidanceDetail: string;
  certificateGuidanceChangedAt: Date | null;
  certificateGuidanceObservedCount: number;
  tlsReadyAt: Date | null;
}) {
  const observationDetail = createProjectDomainCertificateObservationDetail({
    certificateGuidanceObservedCount: input.certificateGuidanceObservedCount,
    certificateGuidanceChangedAt: input.certificateGuidanceChangedAt
  });
  const lastHealthyDetail = input.tlsReadyAt
    ? ` Last healthy HTTPS was confirmed at ${formatProjectDomainCertificateTimestamp(input.tlsReadyAt)}.`
    : '';

  if (input.certificateGuidanceState === 'healthy') {
    return {
      certificateAttentionStatus: 'healthy' as const,
      certificateAttentionTitle: 'No certificate follow-up needed',
      certificateAttentionDetail:
        observationDetail
          ? `The latest certificate guidance is healthy for this host. ${observationDetail}`.trim()
          : 'The latest certificate guidance is healthy for this host.'
    };
  }

  if (isProjectDomainCertificateGuidanceMonitorState(input.certificateGuidanceState)) {
    return {
      certificateAttentionStatus: 'monitor' as const,
      certificateAttentionTitle:
        input.certificateGuidanceState === 'renew-soon'
          ? 'Monitor upcoming certificate renewal'
          : 'Continue monitoring certificate rollout',
      certificateAttentionDetail:
        `${input.certificateGuidanceDetail}${observationDetail ? ` ${observationDetail}` : ''}`.trim()
    };
  }

  if (isProjectDomainCertificateGuidanceIssueState(input.certificateGuidanceState)) {
    const isPersistent =
      input.certificateGuidanceObservedCount >= PROJECT_DOMAIN_CERTIFICATE_PERSISTENT_ATTENTION_OBSERVATIONS;

    return {
      certificateAttentionStatus:
        isPersistent
          ? 'persistent-action-needed' as const
          : 'action-needed' as const,
      certificateAttentionTitle:
        isPersistent
          ? 'Persistent certificate issue'
          : 'Certificate issue needs action',
      certificateAttentionDetail:
        `${input.certificateGuidanceDetail}${observationDetail ? ` ${observationDetail}` : ''}${lastHealthyDetail}`.trim()
    };
  }

  return {
    certificateAttentionStatus: 'monitor' as const,
    certificateAttentionTitle: input.certificateGuidanceTitle,
    certificateAttentionDetail:
      `${input.certificateGuidanceDetail}${observationDetail ? ` ${observationDetail}` : ''}`.trim()
  };
}

function createProjectDomainClaimGuidance(input: {
  defaultHost: string;
  verificationDns: Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'verificationDnsRecordType' | 'verificationDnsRecordName' | 'verificationDnsRecordValue'
  >;
  routingDns: Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'routingDnsRecordType' | 'routingDnsRecordName' | 'routingDnsRecordValue'
  >;
  record: Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'host' | 'routeStatus' | 'verificationStatus' | 'ownershipStatus' | 'tlsStatus'
  >;
}) {
  const isCustomHost = input.record.host !== input.defaultHost;

  if (!isCustomHost) {
    return {
      claimState: 'managed' as const,
      claimTitle: 'Platform-managed host',
      claimDetail: 'This default host is already managed by the platform and does not require manual DNS setup.',
      claimDnsRecordType: null,
      claimDnsRecordName: null,
      claimDnsRecordValue: null
    };
  }

  if (input.record.verificationStatus === 'pending') {
    return {
      claimState: 'publish-verification-record' as const,
      claimTitle: 'Publish verification TXT',
      claimDetail:
        `Create the TXT ownership challenge record for ${input.record.host}, then use Verify Claim or refresh checks to confirm it.`,
      claimDnsRecordType: input.verificationDns.verificationDnsRecordType,
      claimDnsRecordName: input.verificationDns.verificationDnsRecordName,
      claimDnsRecordValue: input.verificationDns.verificationDnsRecordValue
    };
  }

  if (input.record.verificationStatus === 'mismatch') {
    return {
      claimState: 'fix-verification-record' as const,
      claimTitle: 'Fix verification TXT',
      claimDetail:
        `Update the TXT ownership challenge for ${input.record.host} so it matches the expected verification value, then verify again.`,
      claimDnsRecordType: input.verificationDns.verificationDnsRecordType,
      claimDnsRecordName: input.verificationDns.verificationDnsRecordName,
      claimDnsRecordValue: input.verificationDns.verificationDnsRecordValue
    };
  }

  if (input.record.verificationStatus === 'unknown') {
    return {
      claimState: 'refresh-checks' as const,
      claimTitle: 'Retry ownership verification',
      claimDetail:
        `The control plane could not confirm the TXT ownership challenge for ${input.record.host} right now. Verify the record and retry.`,
      claimDnsRecordType: input.verificationDns.verificationDnsRecordType,
      claimDnsRecordName: input.verificationDns.verificationDnsRecordName,
      claimDnsRecordValue: input.verificationDns.verificationDnsRecordValue
    };
  }

  if (input.record.ownershipStatus === 'pending') {
    return {
      claimState: 'configure-dns' as const,
      claimTitle: 'Configure DNS',
      claimDetail:
        `Create a CNAME from ${input.record.host} to ${input.defaultHost}. If your DNS provider does not allow CNAME at the zone apex, use its ALIAS/ANAME/flattened equivalent and then refresh checks.`,
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.ownershipStatus === 'mismatch') {
    return {
      claimState: 'fix-dns' as const,
      claimTitle: 'Fix DNS target',
      claimDetail: `Update DNS so ${input.record.host} resolves to ${input.defaultHost}, then refresh checks.`,
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.ownershipStatus === 'unknown') {
    return {
      claimState: 'refresh-checks' as const,
      claimTitle: 'Retry verification',
      claimDetail: `The control plane could not verify DNS right now. Confirm ${input.record.host} points to ${input.defaultHost} and refresh checks.`,
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.routeStatus === 'pending' || input.record.routeStatus === 'stale') {
    return {
      claimState: 'redeploy-public-service' as const,
      claimTitle: 'Redeploy public service',
      claimDetail:
        'DNS is verified. Run another successful deployment of the public service to attach this host to a live ingress route.',
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.tlsStatus === 'pending') {
    return {
      claimState: 'wait-for-https' as const,
      claimTitle: 'Wait for HTTPS',
      claimDetail:
        'DNS and routing are in place. HTTPS still appears to be provisioning or propagating; refresh checks again shortly.',
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.tlsStatus === 'invalid') {
    return {
      claimState: 'review-https' as const,
      claimTitle: 'Review HTTPS failure',
      claimDetail:
        'DNS and routing are in place, but certificate validation is currently failing. Review the certificate chain and host mapping, then refresh checks.',
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  if (input.record.tlsStatus === 'unknown') {
    return {
      claimState: 'refresh-checks' as const,
      claimTitle: 'Retry HTTPS verification',
      claimDetail:
        'DNS is verified, but HTTPS could not be checked from the control plane right now. Refresh checks after confirming the host is reachable.',
      claimDnsRecordType: input.routingDns.routingDnsRecordType,
      claimDnsRecordName: input.routingDns.routingDnsRecordName,
      claimDnsRecordValue: input.routingDns.routingDnsRecordValue
    };
  }

  return {
    claimState: 'healthy' as const,
    claimTitle: 'Claim healthy',
    claimDetail: 'DNS, routing, and HTTPS all look healthy for this custom host.',
    claimDnsRecordType: input.routingDns.routingDnsRecordType,
    claimDnsRecordName: input.routingDns.routingDnsRecordName,
    claimDnsRecordValue: input.routingDns.routingDnsRecordValue
  };
}

function createProjectDomainCertificateLifecycle(input: {
  defaultHost: string;
  record: Pick<
    ProjectDomainStatusWithDiagnosticsRecord,
    'host' | 'routeStatus' | 'ownershipStatus' | 'tlsStatus' | 'tlsReadyAt'
  >;
}) {
  const isCustomHost = input.record.host !== input.defaultHost;

  if (!isCustomHost) {
    return {
      certificateState: 'managed' as const,
      certificateTitle: 'Platform-managed certificate',
      certificateDetail:
        'This default host is certificate-managed by the platform and does not require manual issuance or renewal steps.'
    };
  }

  if (input.record.routeStatus === 'pending') {
    return {
      certificateState: 'awaiting-route' as const,
      certificateTitle: 'Wait for live route',
      certificateDetail:
        'Certificate issuance starts after this host is attached to a live public route. Redeploy the public service to publish the host, then refresh checks.'
    };
  }

  if (input.record.routeStatus === 'stale') {
    return {
      certificateState: 'awaiting-route' as const,
      certificateTitle: 'Restore live route',
      certificateDetail:
        'This host currently points at a stale deployment. Redeploy the public service so certificate issuance and renewal checks can resume on a live route.'
    };
  }

  if (input.record.ownershipStatus === 'pending') {
    return {
      certificateState: 'awaiting-dns' as const,
      certificateTitle: 'Finish routing DNS',
      certificateDetail:
        'Certificate issuance is waiting for routing DNS to point this host at the platform target. Refresh checks after DNS propagation completes.'
    };
  }

  if (input.record.ownershipStatus === 'mismatch') {
    return {
      certificateState: 'awaiting-dns' as const,
      certificateTitle: 'Fix routing DNS first',
      certificateDetail:
        'Certificate issuance and renewal are blocked because routing DNS no longer points at the platform target. Correct DNS, then refresh checks.'
    };
  }

  if (input.record.ownershipStatus === 'unknown') {
    return {
      certificateState: 'check-unavailable' as const,
      certificateTitle: 'Retry certificate checks',
      certificateDetail:
        'The control plane could not verify routing DNS right now, so certificate issuance and renewal state could not be confirmed.'
    };
  }

  if (input.record.tlsStatus === 'ready') {
    return {
      certificateState: 'active' as const,
      certificateTitle: 'Certificate active',
      certificateDetail:
        'HTTPS is healthy and the currently served certificate validates successfully for this host.'
    };
  }

  if (input.record.tlsStatus === 'pending') {
    if (input.record.tlsReadyAt) {
      return {
        certificateState: 'renewal-attention' as const,
        certificateTitle: 'Recheck certificate health',
        certificateDetail:
          'This host previously had healthy HTTPS, but the latest check is pending again. Renewal or propagation may still be in progress; refresh checks again shortly.'
      };
    }

    return {
      certificateState: 'provisioning' as const,
      certificateTitle: 'Certificate provisioning',
      certificateDetail:
        'DNS and routing are in place. Initial HTTPS issuance still appears to be provisioning or propagating; refresh checks again shortly.'
    };
  }

  if (input.record.tlsStatus === 'invalid') {
    if (input.record.tlsReadyAt) {
      return {
        certificateState: 'renewal-attention' as const,
        certificateTitle: 'Review renewal regression',
        certificateDetail:
          'This host previously had healthy HTTPS, but current certificate validation is failing. Review the served certificate chain, host mapping, and renewal state, then refresh checks.'
      };
    }

    return {
      certificateState: 'issuance-attention' as const,
      certificateTitle: 'Review initial issuance',
      certificateDetail:
        'HTTPS is reachable, but the currently served certificate is not validating yet. Review the served certificate chain and host mapping, then refresh checks.'
    };
  }

  if (input.record.tlsReadyAt) {
    return {
      certificateState: 'renewal-attention' as const,
      certificateTitle: 'Recheck certificate lifecycle',
      certificateDetail:
        'This host previously had healthy HTTPS, but the control plane could not confirm the current certificate state. Refresh checks again and investigate if this persists.'
    };
  }

  return {
    certificateState: 'check-unavailable' as const,
    certificateTitle: 'Retry certificate checks',
    certificateDetail:
      'The control plane could not confirm the current certificate state yet. Refresh checks after the host is reachable from the public internet.'
  };
}

function createProjectDomainCertificateIdentityEventDetail(input: {
  previousFingerprintSha256: string | null;
  nextFingerprintSha256: string;
  certificateIssuerName: string | null;
  certificateSerialNumber: string | null;
  nextStatus: ProjectDomainCertificateIdentityStatus;
}) {
  const previousFingerprintDetail = input.previousFingerprintSha256
    ? ` from ${formatProjectDomainCertificateFingerprintPreview(input.previousFingerprintSha256)}`
    : '';
  const nextFingerprintDetail = formatProjectDomainCertificateFingerprintPreview(input.nextFingerprintSha256);
  const issuerDetail = input.certificateIssuerName
    ? ` Issuer: ${input.certificateIssuerName}.`
    : '';
  const serialDetail = input.certificateSerialNumber
    ? ` Serial: ${input.certificateSerialNumber}.`
    : '';

  if (!input.previousFingerprintSha256) {
    return `Observed certificate fingerprint ${nextFingerprintDetail} for this host.${issuerDetail}${serialDetail}`.trim();
  }

  if (input.nextStatus === 'rotated-attention') {
    return `Observed certificate fingerprint change${previousFingerprintDetail} to ${nextFingerprintDetail}, and the newly served certificate still needs review.${issuerDetail}${serialDetail}`.trim();
  }

  return `Observed certificate fingerprint change${previousFingerprintDetail} to ${nextFingerprintDetail}.${issuerDetail}${serialDetail}`.trim();
}

function createProjectDomainCertificateChainEventDetail(input: {
  previousChainEntries: readonly ProjectDomainCertificateChainEntry[];
  nextChainEntries: readonly ProjectDomainCertificateChainEntry[];
  previousStatus: ProjectDomainCertificateChainStatus;
  nextStatus: ProjectDomainCertificateChainStatus;
  certificateRootSubjectName: string | null;
}) {
  const previousChainSubjects = input.previousChainEntries
    .map((entry) => entry.subjectName)
    .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  const nextChainSubjects = input.nextChainEntries
    .map((entry) => entry.subjectName)
    .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));
  const nextChainDetail = formatProjectDomainCertificateChain(nextChainSubjects)
    ?? 'chain unavailable';
  const previousChainDetail = formatProjectDomainCertificateChain(previousChainSubjects)
    ?? 'chain unavailable';
  const rootDetail = input.certificateRootSubjectName
    ? ` Root: ${input.certificateRootSubjectName}.`
    : '';

  if (input.previousChainEntries.length === 0) {
    return `Observed presented certificate chain ${nextChainDetail}.${rootDetail}`.trim();
  }

  if (
    certificateChainEntriesMatch(input.previousChainEntries, input.nextChainEntries)
    && input.previousStatus !== input.nextStatus
  ) {
    if (input.nextStatus === 'chained') {
      return `The presented certificate chain is still ${nextChainDetail}, and it now validates as a complete chain.${rootDetail}`.trim();
    }

    if (input.nextStatus === 'private-root') {
      return `The presented certificate chain is still ${nextChainDetail}, but the terminating issuer still appears untrusted.${rootDetail}`.trim();
    }

    if (input.nextStatus === 'incomplete') {
      return `The presented certificate chain is still ${nextChainDetail}, but it now appears incomplete or missing trust information.${rootDetail}`.trim();
    }

    return `The presented certificate chain is still ${nextChainDetail}, but its classification changed from ${input.previousStatus} to ${input.nextStatus}.${rootDetail}`.trim();
  }

  if (input.nextStatus === 'incomplete') {
    return `Observed certificate chain change to ${nextChainDetail}; the presented chain may now be incomplete.${rootDetail}`.trim();
  }

  if (input.nextStatus === 'private-root') {
    return `Observed certificate chain change to ${nextChainDetail}; the terminating issuer still appears untrusted.${rootDetail}`.trim();
  }

  return `Observed certificate chain change from ${previousChainDetail} to ${nextChainDetail}.${rootDetail}`.trim();
}

function resolveDiagnosticsStatusChangedAt<TStatus extends string>(input: {
  nextStatus: TStatus;
  previousStatus: TStatus | null;
  previousChangedAt: Date | null;
  fallbackChangedAt: Date | null;
  checkedAt: Date;
}) {
  if (input.previousStatus === input.nextStatus) {
    return input.previousChangedAt ?? input.fallbackChangedAt ?? input.checkedAt;
  }

  return input.checkedAt;
}

function withProjectDomainDiagnosticsState(input: {
  record: ProjectDomainStatusRecord;
  defaultHost: string;
  evaluatedAt: Date;
}): ProjectDomainStatusWithDiagnosticsRecord {
  const verificationDns = createProjectDomainVerificationDnsFields({
    host: input.record.host,
    defaultHost: input.defaultHost,
    verificationToken: input.record.verificationToken
  });
  const routingDns = createProjectDomainRoutingDnsFields({
    host: input.record.host,
    defaultHost: input.defaultHost
  });
  const verification = createFallbackProjectDomainVerification({
    host: input.record.host,
    defaultHost: input.defaultHost,
    verificationToken: input.record.verificationToken,
    storedStatus: input.record.verificationStatus,
    storedDetail: input.record.verificationDetail
  });
  const ownership = createFallbackProjectDomainOwnership({
    host: input.record.host,
    defaultHost: input.defaultHost,
    storedStatus: input.record.ownershipStatus,
    storedDetail: input.record.ownershipDetail
  });
  const tls = createFallbackProjectDomainTls({
    routeStatus: input.record.routeStatus,
    ownershipStatus: ownership.ownershipStatus,
    storedStatus: input.record.tlsStatus,
    storedDetail: input.record.tlsDetail
  });
  const certificateLifecycle = createProjectDomainCertificateLifecycle({
    defaultHost: input.defaultHost,
    record: {
      host: input.record.host,
      routeStatus: input.record.routeStatus,
      ownershipStatus: ownership.ownershipStatus,
      tlsStatus: tls.tlsStatus,
      tlsReadyAt: input.record.tlsReadyAt ?? null
    }
  });
  const certificateValidity = createProjectDomainCertificateValidity({
    certificateValidFrom: input.record.certificateValidFrom ?? null,
    certificateValidTo: input.record.certificateValidTo ?? null,
    evaluatedAt: input.evaluatedAt,
    tlsStatus: tls.tlsStatus
  });
  const certificateTrust = createProjectDomainCertificateTrust({
    tlsStatus: tls.tlsStatus,
    certificateValidityStatus: certificateValidity.certificateValidityStatus,
    certificateValidFrom: input.record.certificateValidFrom ?? null,
    certificateValidTo: input.record.certificateValidTo ?? null,
    certificateValidationReason: input.record.certificateValidationReason ?? null,
    certificateSubjectName: input.record.certificateSubjectName ?? null,
    certificateIssuerName: input.record.certificateIssuerName ?? null,
    certificateSubjectAltNames: input.record.certificateSubjectAltNames ?? []
  });
  const certificateChain = createProjectDomainCertificateChain({
    certificateChainEntries: input.record.certificateChainEntries ?? [],
    certificateChainSubjects: input.record.certificateChainSubjects ?? [],
    certificateRootSubjectName: input.record.certificateRootSubjectName ?? null,
    certificateIssuerName: input.record.certificateIssuerName ?? null,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const certificatePathValidity = createProjectDomainCertificatePathValidity({
    certificateChainEntries: certificateChain.certificateChainEntries,
    evaluatedAt: input.evaluatedAt
  });
  const certificateChainChangedAt =
    input.record.certificateChainChangedAt
    ?? input.record.diagnosticsCheckedAt
    ?? null;
  const certificateChainObservedCount =
    input.record.certificateChainObservedCount > 0
      ? input.record.certificateChainObservedCount
      : input.record.diagnosticsCheckedAt
        ? 1
        : 0;
  const certificateChainLastHealthyAt =
    input.record.certificateChainLastHealthyAt
    ?? (
      certificateChain.certificateChainStatus === 'chained'
        ? input.record.diagnosticsCheckedAt ?? null
        : null
    );
  const certificateLastHealthyChainEntries =
    (input.record.certificateLastHealthyChainEntries?.length ?? 0) > 0
      ? input.record.certificateLastHealthyChainEntries ?? []
      : (
        certificateChain.certificateChainStatus === 'chained'
          ? certificateChain.certificateChainEntries
          : []
      );
  const certificateChainAttention = createProjectDomainCertificateChainAttention({
    certificateChainStatus: certificateChain.certificateChainStatus,
    certificateChainTitle: certificateChain.certificateChainTitle,
    certificateChainDetail: certificateChain.certificateChainDetail,
    certificateChainChangedAt,
    certificateChainObservedCount,
    certificateChainLastHealthyAt,
    diagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null
  });
  const certificateChainHistory = createProjectDomainCertificateChainHistory({
    certificateChainEntries: certificateChain.certificateChainEntries,
    certificateChainStatus: certificateChain.certificateChainStatus,
    certificateLastHealthyChainEntries,
    certificateChainLastHealthyAt
  });
  const certificatePathValidityChangedAt =
    input.record.certificatePathValidityChangedAt
    ?? input.record.diagnosticsCheckedAt
    ?? null;
  const certificatePathValidityObservedCount =
    input.record.certificatePathValidityObservedCount > 0
      ? input.record.certificatePathValidityObservedCount
      : input.record.diagnosticsCheckedAt
        ? 1
        : 0;
  const certificatePathValidityLastHealthyAt =
    input.record.certificatePathValidityLastHealthyAt
    ?? (
      certificatePathValidity.certificatePathValidityStatus === 'valid'
        ? input.record.diagnosticsCheckedAt ?? null
        : null
    );
  const certificateIdentity = createProjectDomainCertificateIdentity({
    certificateFingerprintSha256: input.record.certificateFingerprintSha256 ?? null,
    certificateSerialNumber: input.record.certificateSerialNumber ?? null,
    certificateFirstObservedAt: input.record.certificateFirstObservedAt ?? null,
    certificateChangedAt: input.record.certificateChangedAt ?? null,
    certificateLastRotatedAt: input.record.certificateLastRotatedAt ?? null,
    diagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    tlsStatus: tls.tlsStatus,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const certificateGuidance = createProjectDomainCertificateGuidance({
    routeStatus: input.record.routeStatus,
    ownershipStatus: ownership.ownershipStatus,
    tlsStatus: tls.tlsStatus,
    tlsReadyAt: input.record.tlsReadyAt ?? null,
    certificateValidityStatus: certificateValidity.certificateValidityStatus,
    certificatePathValidityStatus: certificatePathValidity.certificatePathValidityStatus,
    certificatePathValidityDetail: certificatePathValidity.certificatePathValidityDetail,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const certificateGuidanceChangedAt =
    input.record.certificateGuidanceChangedAt
    ?? input.record.diagnosticsCheckedAt
    ?? null;
  const certificateGuidanceObservedCount =
    input.record.certificateGuidanceObservedCount > 0
      ? input.record.certificateGuidanceObservedCount
      : input.record.diagnosticsCheckedAt
        ? 1
        : 0;
  const certificateAttention = createProjectDomainCertificateAttention({
    certificateGuidanceState: certificateGuidance.certificateGuidanceState,
    certificateGuidanceTitle: certificateGuidance.certificateGuidanceTitle,
    certificateGuidanceDetail: certificateGuidance.certificateGuidanceDetail,
    certificateGuidanceChangedAt,
    certificateGuidanceObservedCount,
    tlsReadyAt: input.record.tlsReadyAt ?? null
  });
  const claimGuidance = createProjectDomainClaimGuidance({
    defaultHost: input.defaultHost,
    verificationDns,
    routingDns,
    record: {
      host: input.record.host,
      routeStatus: input.record.routeStatus,
      verificationStatus: verification.verificationStatus,
      ownershipStatus: ownership.ownershipStatus,
      tlsStatus: tls.tlsStatus
    }
  });

  const result = {
    ...input.record
  } as ProjectDomainStatusWithDiagnosticsRecord;

  Object.assign(result, verification);
  Object.assign(result, ownership);
  Object.assign(result, tls);
  Object.assign(result, certificateLifecycle);
  Object.assign(result, certificateValidity);
  Object.assign(result, certificateTrust);
  Object.assign(result, certificateChain);
  Object.assign(result, certificateChainAttention);
  Object.assign(result, certificateChainHistory);
  Object.assign(result, certificatePathValidity);
  Object.assign(result, certificateIdentity);
  Object.assign(result, certificateGuidance);
  Object.assign(result, certificateAttention);
  Object.assign(result, createProjectDomainDiagnosticsFreshness({
    diagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    evaluatedAt: input.evaluatedAt
  }));
  Object.assign(result, claimGuidance);
  Object.assign(result, verificationDns);
  Object.assign(result, routingDns);

  result.certificateValidFrom = input.record.certificateValidFrom ?? null;
  result.certificateValidTo = input.record.certificateValidTo ?? null;
  result.certificateSubjectName = input.record.certificateSubjectName ?? null;
  result.certificateIssuerName = input.record.certificateIssuerName ?? null;
  result.certificateSubjectAltNames = input.record.certificateSubjectAltNames ?? [];
  result.certificateChainSubjects = input.record.certificateChainSubjects ?? [];
  result.certificateChainEntries = certificateChain.certificateChainEntries;
  result.certificateIntermediateSubjectNames = certificateChain.certificateIntermediateSubjectNames;
  result.certificateChainDepth = certificateChain.certificateChainDepth;
  result.certificateRootSubjectName = input.record.certificateRootSubjectName ?? null;
  result.certificateChainChangedAt = certificateChainChangedAt;
  result.certificateChainObservedCount = certificateChainObservedCount;
  result.certificateChainLastHealthyAt = certificateChainLastHealthyAt;
  result.certificateLastHealthyChainEntries = certificateLastHealthyChainEntries;
  result.certificateLastHealthyIntermediateSubjectNames = createProjectDomainCertificateChainRoles(
    certificateLastHealthyChainEntries
  ).certificateIntermediateSubjectNames;
  result.certificateLastHealthyChainDepth = createProjectDomainCertificateChainRoles(
    certificateLastHealthyChainEntries
  ).certificateChainDepth;
  result.certificatePathValidityChangedAt = certificatePathValidityChangedAt;
  result.certificatePathValidityObservedCount = certificatePathValidityObservedCount;
  result.certificatePathValidityLastHealthyAt = certificatePathValidityLastHealthyAt;
  result.certificateValidationReason = input.record.certificateValidationReason ?? null;
  result.certificateFingerprintSha256 = input.record.certificateFingerprintSha256 ?? null;
  result.certificateSerialNumber = input.record.certificateSerialNumber ?? null;
  result.certificateFirstObservedAt = input.record.certificateFirstObservedAt ?? null;
  result.certificateChangedAt = input.record.certificateChangedAt ?? null;
  result.certificateLastRotatedAt = input.record.certificateLastRotatedAt ?? null;
  result.certificateGuidanceChangedAt = certificateGuidanceChangedAt;
  result.certificateGuidanceObservedCount = certificateGuidanceObservedCount;
  result.diagnosticsCheckedAt = input.record.diagnosticsCheckedAt ?? null;
  result.recentEvents = [];
  result.verificationCheckedAt = input.record.verificationCheckedAt ?? null;
  result.verificationStatusChangedAt =
    input.record.verificationStatusChangedAt
    ?? input.record.verificationCheckedAt
    ?? null;
  result.verificationVerifiedAt = input.record.verificationVerifiedAt ?? null;
  result.ownershipStatusChangedAt =
    input.record.ownershipStatusChangedAt
    ?? input.record.diagnosticsCheckedAt
    ?? null;
  result.tlsStatusChangedAt =
    input.record.tlsStatusChangedAt
    ?? input.record.diagnosticsCheckedAt
    ?? null;
  result.ownershipVerifiedAt = input.record.ownershipVerifiedAt ?? null;
  result.tlsReadyAt = input.record.tlsReadyAt ?? null;

  return result;
}

function createPersistedProjectDomainDiagnosticsState(input: {
  record: ProjectDomainStatusRecord;
  defaultHost: string;
  diagnostics: {
    verificationStatus: ProjectDomainVerificationStatus;
    verificationDetail: string;
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
    certificateValidationReason: ProjectDomainCertificateValidationReason | null;
    certificateFingerprintSha256: string | null;
    certificateSerialNumber: string | null;
  };
  checkedAt: Date;
}) {
  const verificationDns = createProjectDomainVerificationDnsFields({
    host: input.record.host,
    defaultHost: input.defaultHost,
    verificationToken: input.record.verificationToken
  });
  const routingDns = createProjectDomainRoutingDnsFields({
    host: input.record.host,
    defaultHost: input.defaultHost
  });
  const nextTlsReadyAt =
    input.diagnostics.tlsStatus === 'ready'
      ? input.checkedAt
      : input.record.tlsReadyAt ?? null;
  const certificateLifecycle = createProjectDomainCertificateLifecycle({
    defaultHost: input.defaultHost,
    record: {
      host: input.record.host,
      routeStatus: input.record.routeStatus,
      ownershipStatus: input.diagnostics.ownershipStatus,
      tlsStatus: input.diagnostics.tlsStatus,
      tlsReadyAt: nextTlsReadyAt
    }
  });
  const certificateValidity = createProjectDomainCertificateValidity({
    certificateValidFrom: input.diagnostics.certificateValidFrom,
    certificateValidTo: input.diagnostics.certificateValidTo,
    evaluatedAt: input.checkedAt,
    tlsStatus: input.diagnostics.tlsStatus
  });
  const certificateTrust = createProjectDomainCertificateTrust({
    tlsStatus: input.diagnostics.tlsStatus,
    certificateValidityStatus: certificateValidity.certificateValidityStatus,
    certificateValidFrom: input.diagnostics.certificateValidFrom,
    certificateValidTo: input.diagnostics.certificateValidTo,
    certificateValidationReason: input.diagnostics.certificateValidationReason,
    certificateSubjectName: input.diagnostics.certificateSubjectName,
    certificateIssuerName: input.diagnostics.certificateIssuerName,
    certificateSubjectAltNames: input.diagnostics.certificateSubjectAltNames
  });
  const certificateChain = createProjectDomainCertificateChain({
    certificateChainEntries: input.diagnostics.certificateChainEntries,
    certificateChainSubjects: input.diagnostics.certificateChainSubjects,
    certificateRootSubjectName: input.diagnostics.certificateRootSubjectName,
    certificateIssuerName: input.diagnostics.certificateIssuerName,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const certificatePathValidity = createProjectDomainCertificatePathValidity({
    certificateChainEntries: certificateChain.certificateChainEntries,
    evaluatedAt: input.checkedAt
  });
  const certificateIdentityTimeline = resolveProjectDomainCertificateIdentityTimeline({
    previousFingerprintSha256: input.record.certificateFingerprintSha256 ?? null,
    nextFingerprintSha256: input.diagnostics.certificateFingerprintSha256,
    previousFirstObservedAt: input.record.certificateFirstObservedAt ?? null,
    previousChangedAt: input.record.certificateChangedAt ?? null,
    previousLastRotatedAt: input.record.certificateLastRotatedAt ?? null,
    checkedAt: input.checkedAt
  });
  const certificateIdentity = createProjectDomainCertificateIdentity({
    certificateFingerprintSha256: input.diagnostics.certificateFingerprintSha256,
    certificateSerialNumber: input.diagnostics.certificateSerialNumber,
    certificateFirstObservedAt: certificateIdentityTimeline.certificateFirstObservedAt,
    certificateChangedAt: certificateIdentityTimeline.certificateChangedAt,
    certificateLastRotatedAt: certificateIdentityTimeline.certificateLastRotatedAt,
    diagnosticsCheckedAt: input.checkedAt,
    tlsStatus: input.diagnostics.tlsStatus,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const certificateGuidance = createProjectDomainCertificateGuidance({
    routeStatus: input.record.routeStatus,
    ownershipStatus: input.diagnostics.ownershipStatus,
    tlsStatus: input.diagnostics.tlsStatus,
    tlsReadyAt: nextTlsReadyAt,
    certificateValidityStatus: certificateValidity.certificateValidityStatus,
    certificatePathValidityStatus: certificatePathValidity.certificatePathValidityStatus,
    certificatePathValidityDetail: certificatePathValidity.certificatePathValidityDetail,
    certificateTrustStatus: certificateTrust.certificateTrustStatus
  });
  const previousState = withProjectDomainDiagnosticsState({
    record: input.record,
    defaultHost: input.defaultHost,
    evaluatedAt: input.checkedAt
  });
  const certificateChainTimeline = resolveProjectDomainCertificateChainTimeline({
    previousChainStatus: previousState.certificateChainStatus,
    nextChainStatus: certificateChain.certificateChainStatus,
    nextChainEntries: certificateChain.certificateChainEntries,
    previousChangedAt:
      input.record.certificateChainChangedAt
      ?? previousState.certificateChainChangedAt,
    previousObservedCount:
      input.record.certificateChainObservedCount > 0
        ? input.record.certificateChainObservedCount
        : previousState.certificateChainObservedCount,
    previousLastHealthyAt:
      input.record.certificateChainLastHealthyAt
      ?? previousState.certificateChainLastHealthyAt,
    previousLastHealthyChainEntries:
      (input.record.certificateLastHealthyChainEntries?.length ?? 0) > 0
        ? input.record.certificateLastHealthyChainEntries ?? []
        : previousState.certificateLastHealthyChainEntries,
    previousDiagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    checkedAt: input.checkedAt
  });
  const certificateGuidanceTimeline = resolveProjectDomainCertificateGuidanceTimeline({
    previousGuidanceState: previousState.certificateGuidanceState,
    nextGuidanceState: certificateGuidance.certificateGuidanceState,
    previousChangedAt: input.record.certificateGuidanceChangedAt ?? previousState.certificateGuidanceChangedAt,
    previousObservedCount:
      input.record.certificateGuidanceObservedCount > 0
        ? input.record.certificateGuidanceObservedCount
        : previousState.certificateGuidanceObservedCount,
    previousDiagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    checkedAt: input.checkedAt
  });
  const certificatePathValidityTimeline = resolveProjectDomainCertificatePathValidityTimeline({
    previousPathValidityStatus: previousState.certificatePathValidityStatus,
    nextPathValidityStatus: certificatePathValidity.certificatePathValidityStatus,
    previousChangedAt:
      input.record.certificatePathValidityChangedAt
      ?? previousState.certificatePathValidityChangedAt,
    previousObservedCount:
      input.record.certificatePathValidityObservedCount > 0
        ? input.record.certificatePathValidityObservedCount
        : previousState.certificatePathValidityObservedCount,
    previousLastHealthyAt:
      input.record.certificatePathValidityLastHealthyAt
      ?? previousState.certificatePathValidityLastHealthyAt,
    previousDiagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    checkedAt: input.checkedAt
  });
  const certificateAttention = createProjectDomainCertificateAttention({
    certificateGuidanceState: certificateGuidance.certificateGuidanceState,
    certificateGuidanceTitle: certificateGuidance.certificateGuidanceTitle,
    certificateGuidanceDetail: certificateGuidance.certificateGuidanceDetail,
    certificateGuidanceChangedAt: certificateGuidanceTimeline.certificateGuidanceChangedAt,
    certificateGuidanceObservedCount: certificateGuidanceTimeline.certificateGuidanceObservedCount,
    tlsReadyAt: nextTlsReadyAt
  });
  const certificateChainAttention = createProjectDomainCertificateChainAttention({
    certificateChainStatus: certificateChain.certificateChainStatus,
    certificateChainTitle: certificateChain.certificateChainTitle,
    certificateChainDetail: certificateChain.certificateChainDetail,
    certificateChainChangedAt: certificateChainTimeline.certificateChainChangedAt,
    certificateChainObservedCount: certificateChainTimeline.certificateChainObservedCount,
    certificateChainLastHealthyAt: certificateChainTimeline.certificateChainLastHealthyAt,
    diagnosticsCheckedAt: input.checkedAt
  });
  const certificateChainHistory = createProjectDomainCertificateChainHistory({
    certificateChainEntries: certificateChain.certificateChainEntries,
    certificateChainStatus: certificateChain.certificateChainStatus,
    certificateLastHealthyChainEntries: certificateChainTimeline.certificateLastHealthyChainEntries,
    certificateChainLastHealthyAt: certificateChainTimeline.certificateChainLastHealthyAt
  });

  const result = {
    ...input.record
  } as ProjectDomainStatusWithDiagnosticsRecord;

  Object.assign(result, input.diagnostics);
  Object.assign(result, certificateLifecycle);
  Object.assign(result, certificateValidity);
  Object.assign(result, certificateTrust);
  Object.assign(result, certificateChain);
  Object.assign(result, certificateChainAttention);
  Object.assign(result, certificateChainHistory);
  Object.assign(result, certificatePathValidity);
  Object.assign(result, certificateIdentity);
  Object.assign(result, certificateGuidance);
  Object.assign(result, certificateAttention);
  Object.assign(result, createProjectDomainDiagnosticsFreshness({
    diagnosticsCheckedAt: input.checkedAt,
    evaluatedAt: input.checkedAt
  }));
  Object.assign(result, createProjectDomainClaimGuidance({
    defaultHost: input.defaultHost,
    verificationDns,
    routingDns,
    record: {
      host: input.record.host,
      routeStatus: input.record.routeStatus,
      verificationStatus: input.diagnostics.verificationStatus,
      ownershipStatus: input.diagnostics.ownershipStatus,
      tlsStatus: input.diagnostics.tlsStatus
    }
  }));
  Object.assign(result, verificationDns);
  Object.assign(result, routingDns);

  result.diagnosticsCheckedAt = input.checkedAt;
  result.certificateHistorySummary = createEmptyProjectDomainCertificateHistorySummary();
  result.recentEvents = [];
  result.certificateValidFrom = input.diagnostics.certificateValidFrom;
  result.certificateValidTo = input.diagnostics.certificateValidTo;
  result.certificateSubjectName = input.diagnostics.certificateSubjectName;
  result.certificateIssuerName = input.diagnostics.certificateIssuerName;
  result.certificateSubjectAltNames = input.diagnostics.certificateSubjectAltNames;
  result.certificateChainSubjects = input.diagnostics.certificateChainSubjects;
  result.certificateChainEntries = certificateChain.certificateChainEntries;
  result.certificateIntermediateSubjectNames = certificateChain.certificateIntermediateSubjectNames;
  result.certificateChainDepth = certificateChain.certificateChainDepth;
  result.certificateRootSubjectName = input.diagnostics.certificateRootSubjectName;
  result.certificateChainChangedAt = certificateChainTimeline.certificateChainChangedAt;
  result.certificateChainObservedCount = certificateChainTimeline.certificateChainObservedCount;
  result.certificateChainLastHealthyAt = certificateChainTimeline.certificateChainLastHealthyAt;
  result.certificateLastHealthyChainEntries = certificateChainTimeline.certificateLastHealthyChainEntries;
  result.certificateLastHealthyIntermediateSubjectNames = createProjectDomainCertificateChainRoles(
    certificateChainTimeline.certificateLastHealthyChainEntries
  ).certificateIntermediateSubjectNames;
  result.certificateLastHealthyChainDepth = createProjectDomainCertificateChainRoles(
    certificateChainTimeline.certificateLastHealthyChainEntries
  ).certificateChainDepth;
  result.certificatePathValidityChangedAt = certificatePathValidityTimeline.certificatePathValidityChangedAt;
  result.certificatePathValidityObservedCount =
    certificatePathValidityTimeline.certificatePathValidityObservedCount;
  result.certificatePathValidityLastHealthyAt =
    certificatePathValidityTimeline.certificatePathValidityLastHealthyAt;
  result.certificateValidationReason = input.diagnostics.certificateValidationReason;
  result.certificateFingerprintSha256 = input.diagnostics.certificateFingerprintSha256;
  result.certificateSerialNumber = input.diagnostics.certificateSerialNumber;
  result.certificateFirstObservedAt = certificateIdentityTimeline.certificateFirstObservedAt;
  result.certificateChangedAt = certificateIdentityTimeline.certificateChangedAt;
  result.certificateLastRotatedAt = certificateIdentityTimeline.certificateLastRotatedAt;
  result.certificateGuidanceChangedAt = certificateGuidanceTimeline.certificateGuidanceChangedAt;
  result.certificateGuidanceObservedCount = certificateGuidanceTimeline.certificateGuidanceObservedCount;
  result.verificationCheckedAt = input.checkedAt;
  result.verificationStatusChangedAt = resolveDiagnosticsStatusChangedAt({
    nextStatus: input.diagnostics.verificationStatus,
    previousStatus: input.record.verificationStatus,
    previousChangedAt: input.record.verificationStatusChangedAt,
    fallbackChangedAt: input.record.verificationCheckedAt,
    checkedAt: input.checkedAt
  });
  result.verificationVerifiedAt =
    input.diagnostics.verificationStatus === 'managed' || input.diagnostics.verificationStatus === 'verified'
      ? input.checkedAt
      : input.record.verificationVerifiedAt ?? null;
  result.ownershipStatusChangedAt = resolveDiagnosticsStatusChangedAt({
    nextStatus: input.diagnostics.ownershipStatus,
    previousStatus: input.record.ownershipStatus,
    previousChangedAt: input.record.ownershipStatusChangedAt,
    fallbackChangedAt: input.record.diagnosticsCheckedAt,
    checkedAt: input.checkedAt
  });
  result.tlsStatusChangedAt = resolveDiagnosticsStatusChangedAt({
    nextStatus: input.diagnostics.tlsStatus,
    previousStatus: input.record.tlsStatus,
    previousChangedAt: input.record.tlsStatusChangedAt,
    fallbackChangedAt: input.record.diagnosticsCheckedAt,
    checkedAt: input.checkedAt
  });
  result.ownershipVerifiedAt =
    input.diagnostics.ownershipStatus === 'managed' || input.diagnostics.ownershipStatus === 'verified'
      ? input.checkedAt
      : input.record.ownershipVerifiedAt ?? null;
  result.tlsReadyAt = nextTlsReadyAt;

  return result;
}

function createProjectDomainTransitionEvents(input: {
  previousRecord: ProjectDomainStatusRecord;
  defaultHost: string;
  nextRecord: ProjectDomainStatusWithDiagnosticsRecord;
  occurredAt: Date;
}): CreateProjectDomainEventInput[] {
  const events: CreateProjectDomainEventInput[] = [];
  const previousState = withProjectDomainDiagnosticsState({
    record: input.previousRecord,
    defaultHost: input.defaultHost,
    evaluatedAt: input.occurredAt
  });

  if (previousState.ownershipStatus !== input.nextRecord.ownershipStatus) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'ownership',
      previousStatus: previousState.ownershipStatus,
      nextStatus: input.nextRecord.ownershipStatus,
      detail: input.nextRecord.ownershipDetail,
      createdAt: input.occurredAt
    });
  }

  if (previousState.tlsStatus !== input.nextRecord.tlsStatus) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'tls',
      previousStatus: previousState.tlsStatus,
      nextStatus: input.nextRecord.tlsStatus,
      detail: input.nextRecord.tlsDetail,
      createdAt: input.occurredAt
    });
  }

  if (previousState.certificateGuidanceState !== input.nextRecord.certificateGuidanceState) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate',
      previousStatus: previousState.certificateGuidanceState,
      nextStatus: input.nextRecord.certificateGuidanceState,
      detail: input.nextRecord.certificateGuidanceDetail,
      createdAt: input.occurredAt
    });
  }

  if (
    previousState.certificateTrustStatus !== input.nextRecord.certificateTrustStatus
    && (
      isProjectDomainCertificateTrustIssueStatus(previousState.certificateTrustStatus)
      || isProjectDomainCertificateTrustIssueStatus(input.nextRecord.certificateTrustStatus)
    )
  ) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate_trust',
      previousStatus: previousState.certificateTrustStatus,
      nextStatus: input.nextRecord.certificateTrustStatus,
      detail: input.nextRecord.certificateTrustDetail,
      createdAt: input.occurredAt
    });
  }

  if (
    previousState.certificatePathValidityStatus !== input.nextRecord.certificatePathValidityStatus
    && (
      isProjectDomainTrackedCertificatePathValidityStatus(previousState.certificatePathValidityStatus)
      || isProjectDomainTrackedCertificatePathValidityStatus(input.nextRecord.certificatePathValidityStatus)
    )
  ) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate_path_validity',
      previousStatus: previousState.certificatePathValidityStatus,
      nextStatus: input.nextRecord.certificatePathValidityStatus,
      detail: input.nextRecord.certificatePathValidityDetail,
      createdAt: input.occurredAt
    });
  }

  if (
    previousState.certificateAttentionStatus !== input.nextRecord.certificateAttentionStatus
    && (
      isProjectDomainEscalatedCertificateAttentionStatus(previousState.certificateAttentionStatus)
      || isProjectDomainEscalatedCertificateAttentionStatus(input.nextRecord.certificateAttentionStatus)
    )
  ) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate_attention',
      previousStatus: previousState.certificateAttentionStatus,
      nextStatus: input.nextRecord.certificateAttentionStatus,
      detail: input.nextRecord.certificateAttentionDetail,
      createdAt: input.occurredAt
    });
  }

  if (
    (
      !certificateChainEntriesMatch(
        previousState.certificateChainEntries ?? [],
        input.nextRecord.certificateChainEntries ?? []
      )
      && (input.nextRecord.certificateChainEntries?.length ?? 0) > 0
    )
    || (
      previousState.certificateChainStatus !== input.nextRecord.certificateChainStatus
      && (
        (previousState.certificateChainEntries?.length ?? 0) > 0
        || (input.nextRecord.certificateChainEntries?.length ?? 0) > 0
      )
    )
  ) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate_chain',
      previousStatus: previousState.certificateChainStatus,
      nextStatus: input.nextRecord.certificateChainStatus,
      detail: createProjectDomainCertificateChainEventDetail({
        previousChainEntries: previousState.certificateChainEntries ?? [],
        nextChainEntries: input.nextRecord.certificateChainEntries ?? [],
        previousStatus: previousState.certificateChainStatus,
        nextStatus: input.nextRecord.certificateChainStatus,
        certificateRootSubjectName: input.nextRecord.certificateRootSubjectName
      }),
      createdAt: input.occurredAt
    });
  }

  if (
    previousState.certificateFingerprintSha256 !== input.nextRecord.certificateFingerprintSha256
    && input.nextRecord.certificateFingerprintSha256
  ) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'certificate_identity',
      previousStatus: previousState.certificateIdentityStatus,
      nextStatus: input.nextRecord.certificateIdentityStatus,
      detail: createProjectDomainCertificateIdentityEventDetail({
        previousFingerprintSha256: previousState.certificateFingerprintSha256,
        nextFingerprintSha256: input.nextRecord.certificateFingerprintSha256,
        certificateIssuerName: input.nextRecord.certificateIssuerName,
        certificateSerialNumber: input.nextRecord.certificateSerialNumber,
        nextStatus: input.nextRecord.certificateIdentityStatus
      }),
      createdAt: input.occurredAt
    });
  }

  return events;
}

export class ProjectsService {
  private readonly repository: ProjectsRepository;
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

  async listProjectIdsForDomainDiagnosticsRefresh(input: {
    staleBefore: Date;
    limit: number;
  }) {
    return this.repository.listProjectIdsForDomainDiagnosticsRefresh(input);
  }

  private async loadProjectDomainStatusRecords(projectId: string) {
    const project = await this.repository.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const normalizedServices = normalizeProjectServices(project.services);
    const defaultHost = createDefaultProjectDomainHost(project.slug);
    const records = await this.repository.listDomains(projectId);
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
        this.repository.updateDomainDiagnostics({
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

    await this.repository.addDomainEvents(domainEvents);

    return this.attachRecentDomainEvents(projectId, refreshedRecords);
  }

  private async attachRecentDomainEvents(
    projectId: string,
    records: ProjectDomainStatusWithDiagnosticsRecord[]
  ): Promise<ProjectDomainStatusWithDiagnosticsRecord[]> {
    if (records.length === 0) {
      return [];
    }

    const recentEvents = await this.repository.listRecentDomainEvents({
      projectId,
      limitPerDomain: 6
    });
    const certificateHistoryEvents = await this.repository.listRecentDomainEvents({
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
      record = await this.repository.createDomain({
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

    const record = await this.repository.findDomainById(input.projectId, input.domainId);
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

    const removed = await this.repository.removeDomain(input.projectId, input.domainId);
    if (!removed) {
      throw new ProjectDomainNotFoundError();
    }
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

    const projectDomains = await this.repository.listDomains(input.projectId);
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
