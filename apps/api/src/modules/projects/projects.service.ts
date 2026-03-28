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
  type ProjectDomainRecord,
  type ProjectDomainEventRecord,
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

  return {
    ...input.record,
    ...verification,
    ...ownership,
    ...tls,
    diagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
    ...createProjectDomainDiagnosticsFreshness({
      diagnosticsCheckedAt: input.record.diagnosticsCheckedAt ?? null,
      evaluatedAt: input.evaluatedAt
    }),
    ...claimGuidance,
    ...verificationDns,
    ...routingDns,
    recentEvents: [],
    verificationCheckedAt: input.record.verificationCheckedAt ?? null,
    verificationStatusChangedAt:
      input.record.verificationStatusChangedAt
      ?? input.record.verificationCheckedAt
      ?? null,
    verificationVerifiedAt: input.record.verificationVerifiedAt ?? null,
    ownershipStatusChangedAt:
      input.record.ownershipStatusChangedAt
      ?? input.record.diagnosticsCheckedAt
      ?? null,
    tlsStatusChangedAt:
      input.record.tlsStatusChangedAt
      ?? input.record.diagnosticsCheckedAt
      ?? null,
    ownershipVerifiedAt: input.record.ownershipVerifiedAt ?? null,
    tlsReadyAt: input.record.tlsReadyAt ?? null
  };
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

  return {
    ...input.record,
    ...input.diagnostics,
    diagnosticsCheckedAt: input.checkedAt,
    ...createProjectDomainDiagnosticsFreshness({
      diagnosticsCheckedAt: input.checkedAt,
      evaluatedAt: input.checkedAt
    }),
    ...createProjectDomainClaimGuidance({
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
    }),
    ...verificationDns,
    ...routingDns,
    recentEvents: [],
    verificationCheckedAt: input.checkedAt,
    verificationStatusChangedAt: resolveDiagnosticsStatusChangedAt({
      nextStatus: input.diagnostics.verificationStatus,
      previousStatus: input.record.verificationStatus,
      previousChangedAt: input.record.verificationStatusChangedAt,
      fallbackChangedAt: input.record.verificationCheckedAt,
      checkedAt: input.checkedAt
    }),
    verificationVerifiedAt:
      input.diagnostics.verificationStatus === 'managed' || input.diagnostics.verificationStatus === 'verified'
        ? input.checkedAt
        : input.record.verificationVerifiedAt ?? null,
    ownershipStatusChangedAt: resolveDiagnosticsStatusChangedAt({
      nextStatus: input.diagnostics.ownershipStatus,
      previousStatus: input.record.ownershipStatus,
      previousChangedAt: input.record.ownershipStatusChangedAt,
      fallbackChangedAt: input.record.diagnosticsCheckedAt,
      checkedAt: input.checkedAt
    }),
    tlsStatusChangedAt: resolveDiagnosticsStatusChangedAt({
      nextStatus: input.diagnostics.tlsStatus,
      previousStatus: input.record.tlsStatus,
      previousChangedAt: input.record.tlsStatusChangedAt,
      fallbackChangedAt: input.record.diagnosticsCheckedAt,
      checkedAt: input.checkedAt
    }),
    ownershipVerifiedAt:
      input.diagnostics.ownershipStatus === 'managed' || input.diagnostics.ownershipStatus === 'verified'
        ? input.checkedAt
        : input.record.ownershipVerifiedAt ?? null,
    tlsReadyAt:
      input.diagnostics.tlsStatus === 'ready'
        ? input.checkedAt
        : input.record.tlsReadyAt ?? null
  } satisfies ProjectDomainStatusWithDiagnosticsRecord;
}

function createProjectDomainTransitionEvents(input: {
  previousRecord: ProjectDomainStatusRecord;
  nextRecord: ProjectDomainStatusWithDiagnosticsRecord;
  occurredAt: Date;
}): CreateProjectDomainEventInput[] {
  const events: CreateProjectDomainEventInput[] = [];

  if (input.previousRecord.ownershipStatus !== input.nextRecord.ownershipStatus) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'ownership',
      previousStatus: input.previousRecord.ownershipStatus ?? null,
      nextStatus: input.nextRecord.ownershipStatus,
      detail: input.nextRecord.ownershipDetail,
      createdAt: input.occurredAt
    });
  }

  if (input.previousRecord.tlsStatus !== input.nextRecord.tlsStatus) {
    events.push({
      projectId: input.previousRecord.projectId,
      domainId: input.previousRecord.id,
      kind: 'tls',
      previousStatus: input.previousRecord.tlsStatus ?? null,
      nextStatus: input.nextRecord.tlsStatus,
      detail: input.nextRecord.tlsDetail,
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

  constructor(
    db: DbClient,
    invitationDelivery: ProjectInvitationDeliveryService = disabledProjectInvitationDeliveryService,
    domainDiagnostics: ProjectDomainDiagnosticsInspector = defaultProjectDomainDiagnosticsService,
    domainRoutes: ProjectDomainRouteManager = defaultProjectDomainRouteService
  ) {
    this.repository = new ProjectsRepository(db);
    this.invitationDelivery = invitationDelivery;
    this.domainDiagnostics = domainDiagnostics;
    this.domainRoutes = domainRoutes;
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
      limitPerDomain: 4
    });
    const eventsByDomainId = new Map<string, ProjectDomainEventRecord[]>();

    for (const event of recentEvents) {
      const existing = eventsByDomainId.get(event.domainId);
      if (existing) {
        existing.push(event);
      } else {
        eventsByDomainId.set(event.domainId, [event]);
      }
    }

    return records.map((record) => ({
      ...record,
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
