import type { ApiProject, ApiProjectDomain } from './api';
import type { DashboardStatusBadgeVariant } from './project-service-status';

export type ProjectRouteDisplayStatus =
  | 'active'
  | 'degraded'
  | 'stale'
  | 'pending'
  | 'unavailable';

export type ProjectDomainOwnershipDisplayStatus =
  NonNullable<ApiProjectDomain['ownershipStatus']>;

export type ProjectDomainVerificationDisplayStatus =
  NonNullable<ApiProjectDomain['verificationStatus']>;

export type ProjectDomainTlsDisplayStatus =
  NonNullable<ApiProjectDomain['tlsStatus']>;

export type ProjectDomainDiagnosticsFreshnessDisplayStatus =
  NonNullable<ApiProjectDomain['diagnosticsFreshnessStatus']>;

export type ProjectDomainClaimDisplayState =
  NonNullable<ApiProjectDomain['claimState']>;

export interface ProjectDomainSummary {
  host: string;
  status: ProjectRouteDisplayStatus;
  label: string;
  detail: string;
  variant: DashboardStatusBadgeVariant;
}

function domainStatusPriority(status: ApiProjectDomain['routeStatus']): number {
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

export function createExpectedProjectDomainHost(project: Pick<ApiProject, 'slug'>): string {
  return `${project.slug}.apps.platform.example.com`;
}

export function sortProjectDomainsForDisplay(
  domains: readonly ApiProjectDomain[]
): ApiProjectDomain[] {
  return domains
    .slice()
    .sort((left, right) => {
      const statusDiff = domainStatusPriority(left.routeStatus) - domainStatusPriority(right.routeStatus);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const updatedAtDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      if (updatedAtDiff !== 0) {
        return updatedAtDiff;
      }

      return left.host.localeCompare(right.host);
    });
}

export function projectRouteStatusVariant(
  status: ProjectRouteDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'degraded' || status === 'pending') {
    return 'warning';
  }

  if (status === 'unavailable') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectRouteStatusLabel(status: ProjectRouteDisplayStatus): string {
  if (status === 'active') {
    return 'route active';
  }

  if (status === 'degraded') {
    return 'route degraded';
  }

  if (status === 'stale') {
    return 'route stale';
  }

  if (status === 'unavailable') {
    return 'route unavailable';
  }

  return 'route pending';
}

export function projectDomainOwnershipStatusVariant(
  status: ProjectDomainOwnershipDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'managed' || status === 'verified') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'mismatch') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainOwnershipLabel(
  status: ProjectDomainOwnershipDisplayStatus
): string {
  if (status === 'managed') {
    return 'dns managed';
  }

  if (status === 'verified') {
    return 'dns verified';
  }

  if (status === 'mismatch') {
    return 'dns mismatch';
  }

  if (status === 'unknown') {
    return 'dns unknown';
  }

  return 'dns pending';
}

export function projectDomainVerificationStatusVariant(
  status: ProjectDomainVerificationDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'managed' || status === 'verified') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'mismatch') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainVerificationLabel(
  status: ProjectDomainVerificationDisplayStatus
): string {
  if (status === 'managed') {
    return 'claim managed';
  }

  if (status === 'verified') {
    return 'claim verified';
  }

  if (status === 'mismatch') {
    return 'claim mismatch';
  }

  if (status === 'unknown') {
    return 'claim unknown';
  }

  return 'claim pending';
}

export function projectDomainTlsStatusVariant(
  status: ProjectDomainTlsDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'ready') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  if (status === 'invalid') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainTlsLabel(
  status: ProjectDomainTlsDisplayStatus
): string {
  if (status === 'ready') {
    return 'tls ready';
  }

  if (status === 'invalid') {
    return 'tls invalid';
  }

  if (status === 'unknown') {
    return 'tls unknown';
  }

  return 'tls pending';
}

export function projectDomainDiagnosticsFreshnessVariant(
  status: ProjectDomainDiagnosticsFreshnessDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'fresh') {
    return 'success';
  }

  if (status === 'stale') {
    return 'warning';
  }

  return 'secondary';
}

export function formatProjectDomainDiagnosticsFreshnessLabel(
  status: ProjectDomainDiagnosticsFreshnessDisplayStatus
): string {
  if (status === 'fresh') {
    return 'checks fresh';
  }

  if (status === 'stale') {
    return 'checks stale';
  }

  return 'checks missing';
}

export function projectDomainClaimVariant(
  status: ProjectDomainClaimDisplayState
): DashboardStatusBadgeVariant {
  if (status === 'healthy' || status === 'managed') {
    return 'success';
  }

  if (status === 'fix-verification-record' || status === 'fix-dns' || status === 'review-https') {
    return 'destructive';
  }

  return 'warning';
}

export function formatProjectDomainClaimLabel(
  status: ProjectDomainClaimDisplayState
): string {
  if (status === 'managed') {
    return 'managed';
  }

  if (status === 'publish-verification-record') {
    return 'publish claim txt';
  }

  if (status === 'fix-verification-record') {
    return 'fix claim txt';
  }

  if (status === 'configure-dns') {
    return 'configure dns';
  }

  if (status === 'fix-dns') {
    return 'fix dns';
  }

  if (status === 'refresh-checks') {
    return 'refresh checks';
  }

  if (status === 'redeploy-public-service') {
    return 'redeploy public service';
  }

  if (status === 'wait-for-https') {
    return 'wait for https';
  }

  if (status === 'review-https') {
    return 'review https';
  }

  return 'claim healthy';
}

export function hasProjectDomainOwnershipDrift(domain: Pick<
  ApiProjectDomain,
  'ownershipStatus' | 'ownershipVerifiedAt'
>): boolean {
  return Boolean(domain.ownershipVerifiedAt)
    && domain.ownershipStatus !== 'managed'
    && domain.ownershipStatus !== 'verified';
}

export function hasProjectDomainTlsRegression(domain: Pick<
  ApiProjectDomain,
  'tlsStatus' | 'tlsReadyAt'
>): boolean {
  return Boolean(domain.tlsReadyAt)
    && domain.tlsStatus !== 'ready';
}

export function formatProjectDomainEventKindLabel(
  kind: NonNullable<ApiProjectDomain['recentEvents']>[number]['kind']
): string {
  return kind === 'ownership' ? 'dns' : 'https';
}

export function formatProjectDomainEventStatusTransition(input: {
  previousStatus: string | null;
  nextStatus: string;
}): string {
  return input.previousStatus
    ? `${input.previousStatus} -> ${input.nextStatus}`
    : input.nextStatus;
}

export function summarizeProjectDomains(input: {
  project: ApiProject;
  domains: readonly ApiProjectDomain[];
  domainsUnavailable?: boolean;
}): ProjectDomainSummary {
  if (input.domainsUnavailable) {
    return {
      host: createExpectedProjectDomainHost(input.project),
      status: 'unavailable',
      label: formatProjectRouteStatusLabel('unavailable'),
      detail: 'Route status could not be loaded right now.',
      variant: projectRouteStatusVariant('unavailable')
    };
  }

  const sortedDomains = sortProjectDomainsForDisplay(input.domains);
  const primaryDomain = sortedDomains[0];

  if (!primaryDomain) {
    return {
      host: createExpectedProjectDomainHost(input.project),
      status: 'pending',
      label: formatProjectRouteStatusLabel('pending'),
      detail: 'No public route has been published for this project yet.',
      variant: projectRouteStatusVariant('pending')
    };
  }

  return {
    host: primaryDomain.host,
    status: primaryDomain.routeStatus,
    label: formatProjectRouteStatusLabel(primaryDomain.routeStatus),
    detail: primaryDomain.statusDetail,
    variant: projectRouteStatusVariant(primaryDomain.routeStatus)
  };
}
