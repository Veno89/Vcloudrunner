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

export type ProjectDomainCertificateDisplayState =
  NonNullable<ApiProjectDomain['certificateState']>;

export type ProjectDomainCertificateValidityDisplayStatus =
  NonNullable<ApiProjectDomain['certificateValidityStatus']>;

export type ProjectDomainCertificateTrustDisplayStatus =
  NonNullable<ApiProjectDomain['certificateTrustStatus']>;

export type ProjectDomainCertificateIdentityDisplayStatus =
  NonNullable<ApiProjectDomain['certificateIdentityStatus']>;

export type ProjectDomainCertificateGuidanceDisplayState =
  NonNullable<ApiProjectDomain['certificateGuidanceState']>;

export type ProjectDomainCertificateAttentionDisplayStatus =
  NonNullable<ApiProjectDomain['certificateAttentionStatus']>;

export type ProjectDomainCertificateChainDisplayStatus =
  NonNullable<ApiProjectDomain['certificateChainStatus']>;

export type ProjectDomainCertificateChainAttentionDisplayStatus =
  NonNullable<ApiProjectDomain['certificateChainAttentionStatus']>;

export type ProjectDomainCertificateChainHistoryDisplayStatus =
  NonNullable<ApiProjectDomain['certificateChainHistoryStatus']>;

export type ProjectDomainCertificatePathValidityDisplayStatus =
  NonNullable<ApiProjectDomain['certificatePathValidityStatus']>;

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
  const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'apps.127.0.0.1.nip.io';
  return `${project.slug}.${domain}`;
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

export function projectDomainCertificateStateVariant(
  status: ProjectDomainCertificateDisplayState
): DashboardStatusBadgeVariant {
  if (status === 'managed' || status === 'active') {
    return 'success';
  }

  if (status === 'issuance-attention' || status === 'renewal-attention') {
    return 'destructive';
  }

  if (status === 'check-unavailable') {
    return 'secondary';
  }

  return 'warning';
}

export function formatProjectDomainCertificateLabel(
  status: ProjectDomainCertificateDisplayState
): string {
  if (status === 'managed') {
    return 'cert managed';
  }

  if (status === 'awaiting-route') {
    return 'cert waiting on route';
  }

  if (status === 'awaiting-dns') {
    return 'cert waiting on dns';
  }

  if (status === 'provisioning') {
    return 'cert provisioning';
  }

  if (status === 'active') {
    return 'cert active';
  }

  if (status === 'issuance-attention') {
    return 'cert issuance issue';
  }

  if (status === 'renewal-attention') {
    return 'cert renewal issue';
  }

  return 'cert check unavailable';
}

export function projectDomainCertificateValidityVariant(
  status: ProjectDomainCertificateValidityDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'valid') {
    return 'success';
  }

  if (status === 'expiring-soon') {
    return 'warning';
  }

  if (status === 'expired' || status === 'not-yet-valid') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainCertificateValidityLabel(
  status: ProjectDomainCertificateValidityDisplayStatus
): string {
  if (status === 'valid') {
    return 'cert dates valid';
  }

  if (status === 'expiring-soon') {
    return 'cert expiring soon';
  }

  if (status === 'expired') {
    return 'cert expired';
  }

  if (status === 'not-yet-valid') {
    return 'cert not yet valid';
  }

  return 'cert dates unavailable';
}

export function projectDomainCertificateTrustVariant(
  status: ProjectDomainCertificateTrustDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'trusted') {
    return 'success';
  }

  if (status === 'unavailable') {
    return 'secondary';
  }

  if (status === 'date-invalid') {
    return 'warning';
  }

  return 'destructive';
}

export function formatProjectDomainCertificateTrustLabel(
  status: ProjectDomainCertificateTrustDisplayStatus
): string {
  if (status === 'trusted') {
    return 'cert trusted';
  }

  if (status === 'date-invalid') {
    return 'cert date issue';
  }

  if (status === 'hostname-mismatch') {
    return 'cert host mismatch';
  }

  if (status === 'self-signed') {
    return 'cert self-signed';
  }

  if (status === 'issuer-untrusted') {
    return 'cert issuer untrusted';
  }

  if (status === 'validation-failed') {
    return 'cert validation failed';
  }

  return 'cert trust unavailable';
}

export function projectDomainCertificateIdentityVariant(
  status: ProjectDomainCertificateIdentityDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'stable') {
    return 'success';
  }

  if (status === 'first-observed' || status === 'rotated') {
    return 'warning';
  }

  if (status === 'rotated-attention') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainCertificateIdentityLabel(
  status: ProjectDomainCertificateIdentityDisplayStatus
): string {
  if (status === 'first-observed') {
    return 'cert first observed';
  }

  if (status === 'stable') {
    return 'cert identity stable';
  }

  if (status === 'rotated') {
    return 'cert rotated';
  }

  if (status === 'rotated-attention') {
    return 'cert rotated w/ issues';
  }

  return 'cert identity unavailable';
}

export function projectDomainCertificateGuidanceVariant(
  status: ProjectDomainCertificateGuidanceDisplayState
): DashboardStatusBadgeVariant {
  if (status === 'healthy') {
    return 'success';
  }

  if (
    status === 'renew-now'
    || status === 'fix-coverage'
    || status === 'fix-trust'
  ) {
    return 'destructive';
  }

  if (status === 'refresh-checks') {
    return 'secondary';
  }

  return 'warning';
}

export function formatProjectDomainCertificateGuidanceLabel(
  status: ProjectDomainCertificateGuidanceDisplayState
): string {
  if (status === 'healthy') {
    return 'cert healthy';
  }

  if (status === 'wait-for-route') {
    return 'wait for route';
  }

  if (status === 'wait-for-dns') {
    return 'wait for dns';
  }

  if (status === 'wait-for-issuance') {
    return 'wait for issuance';
  }

  if (status === 'renew-soon') {
    return 'renew soon';
  }

  if (status === 'renew-now') {
    return 'renew now';
  }

  if (status === 'fix-coverage') {
    return 'fix cert coverage';
  }

  if (status === 'fix-trust') {
    return 'fix cert trust';
  }

  return 'refresh checks';
}

export function projectDomainCertificateAttentionVariant(
  status: ProjectDomainCertificateAttentionDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'healthy') {
    return 'success';
  }

  if (status === 'monitor' || status === 'action-needed') {
    return 'warning';
  }

  return 'destructive';
}

export function formatProjectDomainCertificateAttentionLabel(
  status: ProjectDomainCertificateAttentionDisplayStatus
): string {
  if (status === 'healthy') {
    return 'cert follow-up clear';
  }

  if (status === 'monitor') {
    return 'cert monitor';
  }

  if (status === 'action-needed') {
    return 'cert action needed';
  }

  return 'cert persistent issue';
}

export function projectDomainCertificateChainVariant(
  status: ProjectDomainCertificateChainDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'chained') {
    return 'success';
  }

  if (status === 'leaf-only') {
    return 'warning';
  }

  if (status === 'private-root' || status === 'self-signed-leaf' || status === 'incomplete') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainCertificateChainLabel(
  status: ProjectDomainCertificateChainDisplayStatus
): string {
  if (status === 'chained') {
    return 'cert chain captured';
  }

  if (status === 'leaf-only') {
    return 'cert leaf only';
  }

  if (status === 'incomplete') {
    return 'cert chain incomplete';
  }

  if (status === 'private-root') {
    return 'cert private root';
  }

  if (status === 'self-signed-leaf') {
    return 'cert self-signed leaf';
  }

  return 'cert chain unavailable';
}

export function projectDomainCertificateChainAttentionVariant(
  status: ProjectDomainCertificateChainAttentionDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'healthy') {
    return 'success';
  }

  if (status === 'monitor') {
    return 'warning';
  }

  return 'destructive';
}

export function formatProjectDomainCertificateChainAttentionLabel(
  status: ProjectDomainCertificateChainAttentionDisplayStatus
): string {
  if (status === 'healthy') {
    return 'chain follow-up clear';
  }

  if (status === 'monitor') {
    return 'chain monitor';
  }

  if (status === 'action-needed') {
    return 'chain action needed';
  }

  return 'chain persistent issue';
}

export function projectDomainCertificateChainHistoryVariant(
  status: ProjectDomainCertificateChainHistoryDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'stable') {
    return 'success';
  }

  if (status === 'baseline-missing' || status === 'rotated') {
    return 'warning';
  }

  if (status === 'degraded' || status === 'drifted') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainCertificateChainHistoryLabel(
  status: ProjectDomainCertificateChainHistoryDisplayStatus
): string {
  if (status === 'stable') {
    return 'chain history stable';
  }

  if (status === 'rotated') {
    return 'chain history rotated';
  }

  if (status === 'degraded') {
    return 'chain history degraded';
  }

  if (status === 'drifted') {
    return 'chain history drifted';
  }

  if (status === 'baseline-missing') {
    return 'chain history pending';
  }

  return 'chain history unavailable';
}

export function projectDomainCertificatePathValidityVariant(
  status: ProjectDomainCertificatePathValidityDisplayStatus
): DashboardStatusBadgeVariant {
  if (status === 'valid') {
    return 'success';
  }

  if (status === 'expiring-soon') {
    return 'warning';
  }

  if (status === 'expired' || status === 'not-yet-valid') {
    return 'destructive';
  }

  return 'secondary';
}

export function formatProjectDomainCertificatePathValidityLabel(
  status: ProjectDomainCertificatePathValidityDisplayStatus
): string {
  if (status === 'valid') {
    return 'path dates valid';
  }

  if (status === 'expiring-soon') {
    return 'path expiring soon';
  }

  if (status === 'expired') {
    return 'path expired';
  }

  if (status === 'not-yet-valid') {
    return 'path not yet valid';
  }

  return 'path dates unavailable';
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

export function hasProjectDomainRecentCertificateRotation(domain: Pick<
  ApiProjectDomain,
  'certificateIdentityStatus'
>): boolean {
  return domain.certificateIdentityStatus === 'rotated'
    || domain.certificateIdentityStatus === 'rotated-attention';
}

export function hasProjectDomainCertificateIdentityAttention(domain: Pick<
  ApiProjectDomain,
  'certificateIdentityStatus'
>): boolean {
  return domain.certificateIdentityStatus === 'rotated-attention';
}

export function hasProjectDomainPersistentCertificateAttention(domain: Pick<
  ApiProjectDomain,
  'certificateAttentionStatus'
>): boolean {
  return domain.certificateAttentionStatus === 'persistent-action-needed';
}

export function hasProjectDomainPersistentCertificateChainAttention(domain: Pick<
  ApiProjectDomain,
  'certificateChainAttentionStatus'
>): boolean {
  return domain.certificateChainAttentionStatus === 'persistent-action-needed';
}

export function hasProjectDomainCertificateChainHistoryIssue(domain: Pick<
  ApiProjectDomain,
  'certificateChainHistoryStatus'
>): boolean {
  return domain.certificateChainHistoryStatus === 'degraded'
    || domain.certificateChainHistoryStatus === 'drifted';
}

export function hasProjectDomainCertificatePathValidityIssue(domain: Pick<
  ApiProjectDomain,
  'certificatePathValidityStatus'
>): boolean {
  return domain.certificatePathValidityStatus === 'expired'
    || domain.certificatePathValidityStatus === 'not-yet-valid';
}

export function formatProjectDomainEventKindLabel(
  kind: NonNullable<ApiProjectDomain['recentEvents']>[number]['kind']
): string {
  if (kind === 'ownership') {
    return 'dns';
  }

  if (kind === 'certificate') {
    return 'certificate';
  }

  if (kind === 'certificate_trust') {
    return 'certificate trust';
  }

  if (kind === 'certificate_path_validity') {
    return 'issuer-path dates';
  }

  if (kind === 'certificate_identity') {
    return 'certificate identity';
  }

  if (kind === 'certificate_attention') {
    return 'certificate attention';
  }

  if (kind === 'certificate_chain') {
    return 'certificate chain';
  }

  return 'https';
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
