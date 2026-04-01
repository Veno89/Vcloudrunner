import type { ApiProjectDomain } from '@/lib/api';
import {
  formatProjectDomainEventKindLabel,
  hasProjectDomainCertificateIdentityAttention,
  hasProjectDomainCertificatePathValidityIssue,
  hasProjectDomainOwnershipDrift,
  hasProjectDomainPersistentCertificateAttention,
  hasProjectDomainPersistentCertificateChainAttention,
  hasProjectDomainCertificateChainHistoryIssue,
  hasProjectDomainRecentCertificateRotation,
  hasProjectDomainTlsRegression
} from '@/lib/project-domains';
import { formatCertificateFingerprintPreview } from '@vcloudrunner/shared-types';
import { formatRelativeTime } from '@/lib/helpers';

// ---------------------------------------------------------------------------
// Pure timeline / formatting helpers – extracted from domains page.tsx
// ---------------------------------------------------------------------------

export function describeVerificationTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.verificationStatusChangedAt ?? domain.verificationCheckedAt;
  if (!changedAt || !domain.verificationStatus) {
    return null;
  }

  if (domain.verificationStatus === 'managed' || domain.verificationStatus === 'verified') {
    return `Current claim-verification state since ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.verificationStatus === 'mismatch') {
    return `Ownership TXT mismatch first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.verificationStatus === 'pending') {
    return `Ownership TXT challenge still pending as of ${formatRelativeTime(changedAt)}.`;
  }

  return `Ownership TXT verification has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

export function describeOwnershipTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.ownershipStatusChangedAt ?? domain.diagnosticsCheckedAt;
  if (!changedAt || !domain.ownershipStatus) {
    return null;
  }

  if (domain.ownershipStatus === 'managed' || domain.ownershipStatus === 'verified') {
    return `Current DNS state since ${formatRelativeTime(changedAt)}.`;
  }

  if (hasProjectDomainOwnershipDrift(domain) && domain.ownershipVerifiedAt) {
    if (domain.ownershipStatus === 'mismatch') {
      return `DNS drift detected ${formatRelativeTime(changedAt)} after last confirmation ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
    }

    if (domain.ownershipStatus === 'pending') {
      return `DNS stopped pointing at the platform target ${formatRelativeTime(changedAt)} after last confirmation ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
    }

    return `Automatic DNS verification has been uncertain since ${formatRelativeTime(changedAt)}; last confirmation was ${formatRelativeTime(domain.ownershipVerifiedAt)}.`;
  }

  if (domain.ownershipStatus === 'mismatch') {
    return `DNS mismatch first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.ownershipStatus === 'pending') {
    return `DNS pending since ${formatRelativeTime(changedAt)}.`;
  }

  return `Automatic DNS verification has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

export function describeTlsTimeline(domain: ApiProjectDomain): string | null {
  const changedAt = domain.tlsStatusChangedAt ?? domain.diagnosticsCheckedAt;
  if (!changedAt || !domain.tlsStatus) {
    return null;
  }

  if (domain.tlsStatus === 'ready') {
    return `Current HTTPS state since ${formatRelativeTime(changedAt)}.`;
  }

  if (hasProjectDomainTlsRegression(domain) && domain.tlsReadyAt) {
    if (domain.tlsStatus === 'invalid') {
      return `Certificate validation started failing ${formatRelativeTime(changedAt)} after last healthy HTTPS ${formatRelativeTime(domain.tlsReadyAt)}.`;
    }

    if (domain.tlsStatus === 'pending') {
      return `HTTPS stopped looking healthy ${formatRelativeTime(changedAt)} after last healthy HTTPS ${formatRelativeTime(domain.tlsReadyAt)}.`;
    }

    return `HTTPS could not be revalidated ${formatRelativeTime(changedAt)}; last healthy HTTPS was ${formatRelativeTime(domain.tlsReadyAt)}.`;
  }

  if (domain.tlsStatus === 'invalid') {
    return `Certificate validation failures were first recorded ${formatRelativeTime(changedAt)}.`;
  }

  if (domain.tlsStatus === 'pending') {
    return `HTTPS is still pending as of ${formatRelativeTime(changedAt)}.`;
  }

  return `HTTPS status has been unavailable since ${formatRelativeTime(changedAt)}.`;
}

export function formatCertificateValidationReason(reason: ApiProjectDomain['certificateValidationReason']): string | null {
  if (!reason) {
    return null;
  }

  return reason.replace(/-/g, ' ');
}

export function formatCertificateCoverageNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 4) {
    return names.join(', ');
  }

  return `${names.slice(0, 4).join(', ')} (+${names.length - 4} more)`;
}

export function formatCertificateChainNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 4) {
    return names.join(' -> ');
  }

  return `${names.slice(0, 4).join(' -> ')} (+${names.length - 4} more)`;
}

export function formatCertificateIntermediateNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 3) {
    return names.join(', ');
  }

  return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
}

export function formatCertificateChainEntrySummary(
  entries:
    | Array<{
        subjectName: string | null;
        issuerName: string | null;
        fingerprintSha256: string | null;
        serialNumber: string | null;
        isSelfIssued: boolean;
        validFrom?: string | null;
        validTo?: string | null;
      }>
    | undefined,
  index: number
) {
  const entry = entries?.[index];
  if (!entry) {
    return null;
  }

  const total = entries.length;
  const role =
    index === 0
      ? 'Leaf'
      : index === total - 1
        ? 'Root'
        : `Intermediate ${index}`;
  const subject = entry.subjectName ?? 'Unnamed certificate';
  const issuerDetail = entry.issuerName
    ? `issued by ${entry.issuerName}`
    : null;
  const serialDetail = entry.serialNumber
    ? `serial ${entry.serialNumber}`
    : null;
  const fingerprintDetail = formatCertificateFingerprintPreview(entry.fingerprintSha256);
  const fingerprintLabel = fingerprintDetail
    ? `fingerprint ${fingerprintDetail}`
    : null;
  const selfIssuedDetail = entry.isSelfIssued
    ? 'self-issued'
    : null;
  const validityDetail = formatCertificateChainEntryValidity(entry);
  const details = [
    issuerDetail,
    serialDetail,
    fingerprintLabel,
    selfIssuedDetail,
    validityDetail
  ].filter((value): value is string => Boolean(value));

  return `${role}: ${subject}${details.length > 0 ? ` (${details.join('; ')})` : ''}`;
}

export function getCertificateChainEntryValidityStatus(entry: {
  validFrom?: string | null;
  validTo?: string | null;
}) {
  const now = Date.now();
  const validFrom = entry.validFrom ? Date.parse(entry.validFrom) : Number.NaN;
  const validTo = entry.validTo ? Date.parse(entry.validTo) : Number.NaN;

  if (Number.isNaN(validFrom) && Number.isNaN(validTo)) {
    return 'unavailable' as const;
  }

  if (!Number.isNaN(validFrom) && validFrom > now) {
    return 'not-yet-valid' as const;
  }

  if (!Number.isNaN(validTo) && validTo <= now) {
    return 'expired' as const;
  }

  if (!Number.isNaN(validTo) && validTo - now <= 30 * 24 * 60 * 60 * 1000) {
    return 'expiring-soon' as const;
  }

  return 'valid' as const;
}

export function formatCertificateChainEntryValidity(entry: {
  validFrom?: string | null;
  validTo?: string | null;
}) {
  const validityStatus = getCertificateChainEntryValidityStatus(entry);

  if (validityStatus === 'expired' && entry.validTo) {
    return `expired ${formatRelativeTime(entry.validTo)}`;
  }

  if (validityStatus === 'not-yet-valid' && entry.validFrom) {
    return `valid from ${formatRelativeTime(entry.validFrom)}`;
  }

  if (validityStatus === 'expiring-soon' && entry.validTo) {
    return `valid until ${formatRelativeTime(entry.validTo)}`;
  }

  if (validityStatus === 'valid' && entry.validTo) {
    return `in-date until ${formatRelativeTime(entry.validTo)}`;
  }

  return validityStatus === 'unavailable'
    ? 'validity window unavailable'
    : null;
}

export function describeCertificateIdentityTimeline(domain: ApiProjectDomain): string | null {
  if (domain.certificateLastRotatedAt) {
    return `Last certificate rotation recorded ${formatRelativeTime(domain.certificateLastRotatedAt)}.`;
  }

  if (domain.certificateFirstObservedAt) {
    return `Certificate identity first recorded ${formatRelativeTime(domain.certificateFirstObservedAt)}.`;
  }

  return null;
}

export function describeCertificateAttentionTimeline(domain: ApiProjectDomain): string | null {
  const observedCount = domain.certificateGuidanceObservedCount ?? 0;
  const changedAt = domain.certificateGuidanceChangedAt ?? domain.diagnosticsCheckedAt;

  if (observedCount <= 0 && !changedAt) {
    return null;
  }

  if (observedCount > 1 && changedAt) {
    return `Current certificate follow-up state has been observed across ${observedCount} consecutive checks since ${formatRelativeTime(changedAt)}.`;
  }

  if (observedCount > 1) {
    return `Current certificate follow-up state has been observed across ${observedCount} consecutive checks.`;
  }

  if (changedAt) {
    return `Current certificate follow-up state was first recorded ${formatRelativeTime(changedAt)}.`;
  }

  return null;
}

export function describeCertificateChainTimeline(domain: ApiProjectDomain): string | null {
  const observedCount = domain.certificateChainObservedCount ?? 0;
  const changedAt = domain.certificateChainChangedAt ?? domain.diagnosticsCheckedAt;

  if (observedCount > 1 && changedAt) {
    return `Current presented-chain state has been observed across ${observedCount} consecutive checks since ${formatRelativeTime(changedAt)}.`;
  }

  if (observedCount > 1) {
    return `Current presented-chain state has been observed across ${observedCount} consecutive checks.`;
  }

  if (changedAt) {
    if (domain.certificateChainStatus === 'chained') {
      return `Full presented chain first recorded ${formatRelativeTime(changedAt)}.`;
    }

    return `Current presented-chain state was first recorded ${formatRelativeTime(changedAt)}.`;
  }

  return null;
}

export function describeCertificateChainHistoryTimeline(domain: ApiProjectDomain): string | null {
  if (domain.certificateChainHistoryStatus === 'stable' && domain.certificateChainLastHealthyAt) {
    return `Last healthy issuer path confirmed ${formatRelativeTime(domain.certificateChainLastHealthyAt)}.`;
  }

  if (
    (domain.certificateChainHistoryStatus === 'degraded' || domain.certificateChainHistoryStatus === 'drifted')
    && domain.certificateChainLastHealthyAt
  ) {
    return `Current chain differs from or regressed after the last healthy path confirmed ${formatRelativeTime(domain.certificateChainLastHealthyAt)}.`;
  }

  return null;
}

export function describeCertificatePathValidityTimeline(domain: ApiProjectDomain): string | null {
  const observedCount = domain.certificatePathValidityObservedCount ?? 0;
  const changedAt = domain.certificatePathValidityChangedAt ?? domain.diagnosticsCheckedAt;

  if (observedCount > 1 && changedAt) {
    return `Current issuer-path date state has been observed across ${observedCount} consecutive checks since ${formatRelativeTime(changedAt)}.`;
  }

  if (observedCount > 1) {
    return `Current issuer-path date state has been observed across ${observedCount} consecutive checks.`;
  }

  if (changedAt && hasProjectDomainCertificatePathValidityIssue(domain) && domain.certificatePathValidityLastHealthyAt) {
    return `Issuer-path date regression was first recorded ${formatRelativeTime(changedAt)} after the last fully in-date path ${formatRelativeTime(domain.certificatePathValidityLastHealthyAt)}.`;
  }

  if (changedAt) {
    return `Current issuer-path date state was first recorded ${formatRelativeTime(changedAt)}.`;
  }

  return null;
}

export function describeCertificateHistorySummary(domain: ApiProjectDomain): string | null {
  const summary = domain.certificateHistorySummary;
  if (!summary) {
    return null;
  }

  if (summary.eventCount === 0) {
    return 'No trust, issuer-path, chain, or certificate follow-up history has been recorded for this host yet.';
  }

  return `Tracked ${summary.eventCount} certificate history event${summary.eventCount === 1 ? '' : 's'}: ${summary.incidentCount} incident${summary.incidentCount === 1 ? '' : 's'}, ${summary.recoveryCount} recover${summary.recoveryCount === 1 ? 'y' : 'ies'}${summary.pathWarningCount > 0 ? `, and ${summary.pathWarningCount} issuer-path renewal warning${summary.pathWarningCount === 1 ? '' : 's'}` : ''}.`;
}

export function describeCertificateHistoryBreakdown(domain: ApiProjectDomain): string | null {
  const summary = domain.certificateHistorySummary;
  if (!summary || summary.incidentCount === 0) {
    return null;
  }

  const parts: string[] = [];

  if (summary.trustIncidentCount > 0) {
    parts.push(`${summary.trustIncidentCount} trust`);
  }

  if (summary.pathIncidentCount > 0) {
    parts.push(`${summary.pathIncidentCount} issuer-path`);
  }

  if (summary.chainIncidentCount > 0) {
    parts.push(`${summary.chainIncidentCount} chain`);
  }

  if (summary.attentionIncidentCount > 0) {
    parts.push(`${summary.attentionIncidentCount} follow-up`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `Incident mix: ${parts.join(', ')}.`;
}

export function describeCertificateHistoryTimeline(domain: ApiProjectDomain): string | null {
  const summary = domain.certificateHistorySummary;
  if (!summary || summary.eventCount === 0) {
    return null;
  }

  const parts: string[] = [];

  if (summary.lastIncidentAt && summary.lastIncidentKind) {
    parts.push(
      `Last incident: ${formatProjectDomainEventKindLabel(summary.lastIncidentKind)} ${formatRelativeTime(summary.lastIncidentAt)}`
    );
  }

  if (summary.lastRecoveryAt && summary.lastRecoveryKind) {
    parts.push(
      `Last recovery: ${formatProjectDomainEventKindLabel(summary.lastRecoveryKind)} ${formatRelativeTime(summary.lastRecoveryAt)}`
    );
  }

  if (summary.lastPathWarningAt) {
    parts.push(`Latest issuer-path renewal warning ${formatRelativeTime(summary.lastPathWarningAt)}`);
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : null;
}

// ---------------------------------------------------------------------------
// Domain diagnostics summary – consolidates 40+ inline counter variables
// ---------------------------------------------------------------------------

export interface DomainDiagnosticsSummary {
  staleDiagnosticsCount: number;
  uncheckedDiagnosticsCount: number;
  ownershipDriftCount: number;
  tlsRegressionCount: number;
  certificateProvisioningCount: number;
  certificateAttentionCount: number;
  certificateCheckUnavailableCount: number;
  certificateExpiringSoonCount: number;
  certificateExpiredCount: number;
  certificateDatesUnavailableCount: number;
  certificatePathExpiringSoonCount: number;
  certificatePathInvalidCount: number;
  certificatePathUnavailableCount: number;
  certificateTrustIssueCount: number;
  certificateFirstObservedCount: number;
  certificateRotationCount: number;
  certificateRotationAttentionCount: number;
  certificateIdentityUnavailableCount: number;
  certificateRenewSoonCount: number;
  certificateRenewNowCount: number;
  certificateAttentionMonitorCount: number;
  certificateAttentionActionCount: number;
  certificateAttentionPersistentCount: number;
  certificateChainCapturedCount: number;
  certificateChainLeafOnlyCount: number;
  certificateChainIssueCount: number;
  certificateChainAttentionMonitorCount: number;
  certificateChainAttentionActionCount: number;
  certificateChainAttentionPersistentCount: number;
  certificateChainHistoryRotatedCount: number;
  certificateChainHistoryIssueCount: number;
  certificateChainHistoryBaselineMissingCount: number;
  certificateHistoryTrackedHostCount: number;
  certificateHistoryIncidentCount: number;
  certificateHistoryRecoveryCount: number;
  certificateHistoryPathWarningCount: number;
}

export function computeDomainDiagnosticsSummary(
  sortedDomains: ApiProjectDomain[]
): DomainDiagnosticsSummary {
  return {
    staleDiagnosticsCount: sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'stale'
    ).length,
    uncheckedDiagnosticsCount: sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'unchecked'
    ).length,
    ownershipDriftCount: sortedDomains.filter(hasProjectDomainOwnershipDrift).length,
    tlsRegressionCount: sortedDomains.filter(hasProjectDomainTlsRegression).length,
    certificateProvisioningCount: sortedDomains.filter(
      (domain) => domain.certificateState === 'provisioning'
    ).length,
    certificateAttentionCount: sortedDomains.filter(
      (domain) =>
        domain.certificateState === 'issuance-attention'
        || domain.certificateState === 'renewal-attention'
    ).length,
    certificateCheckUnavailableCount: sortedDomains.filter(
      (domain) => domain.certificateState === 'check-unavailable'
    ).length,
    certificateExpiringSoonCount: sortedDomains.filter(
      (domain) => domain.certificateValidityStatus === 'expiring-soon'
    ).length,
    certificateExpiredCount: sortedDomains.filter(
      (domain) =>
        domain.certificateValidityStatus === 'expired'
        || domain.certificateValidityStatus === 'not-yet-valid'
    ).length,
    certificateDatesUnavailableCount: sortedDomains.filter(
      (domain) => domain.certificateValidityStatus === 'unavailable'
    ).length,
    certificatePathExpiringSoonCount: sortedDomains.filter(
      (domain) => domain.certificatePathValidityStatus === 'expiring-soon'
    ).length,
    certificatePathInvalidCount: sortedDomains.filter(
      hasProjectDomainCertificatePathValidityIssue
    ).length,
    certificatePathUnavailableCount: sortedDomains.filter(
      (domain) => domain.certificatePathValidityStatus === 'unavailable'
    ).length,
    certificateTrustIssueCount: sortedDomains.filter(
      (domain) =>
        domain.certificateTrustStatus === 'hostname-mismatch'
        || domain.certificateTrustStatus === 'self-signed'
        || domain.certificateTrustStatus === 'issuer-untrusted'
        || domain.certificateTrustStatus === 'validation-failed'
    ).length,
    certificateFirstObservedCount: sortedDomains.filter(
      (domain) => domain.certificateIdentityStatus === 'first-observed'
    ).length,
    certificateRotationCount: sortedDomains.filter(hasProjectDomainRecentCertificateRotation).length,
    certificateRotationAttentionCount: sortedDomains.filter(
      hasProjectDomainCertificateIdentityAttention
    ).length,
    certificateIdentityUnavailableCount: sortedDomains.filter(
      (domain) => domain.certificateIdentityStatus === 'unavailable'
    ).length,
    certificateRenewSoonCount: sortedDomains.filter(
      (domain) => domain.certificateGuidanceState === 'renew-soon'
    ).length,
    certificateRenewNowCount: sortedDomains.filter(
      (domain) => domain.certificateGuidanceState === 'renew-now'
    ).length,
    certificateAttentionMonitorCount: sortedDomains.filter(
      (domain) => domain.certificateAttentionStatus === 'monitor'
    ).length,
    certificateAttentionActionCount: sortedDomains.filter(
      (domain) => domain.certificateAttentionStatus === 'action-needed'
    ).length,
    certificateAttentionPersistentCount: sortedDomains.filter(
      hasProjectDomainPersistentCertificateAttention
    ).length,
    certificateChainCapturedCount: sortedDomains.filter(
      (domain) => domain.certificateChainStatus === 'chained'
    ).length,
    certificateChainLeafOnlyCount: sortedDomains.filter(
      (domain) => domain.certificateChainStatus === 'leaf-only'
    ).length,
    certificateChainIssueCount: sortedDomains.filter(
      (domain) =>
        domain.certificateChainStatus === 'incomplete'
        || domain.certificateChainStatus === 'private-root'
        || domain.certificateChainStatus === 'self-signed-leaf'
    ).length,
    certificateChainAttentionMonitorCount: sortedDomains.filter(
      (domain) => domain.certificateChainAttentionStatus === 'monitor'
    ).length,
    certificateChainAttentionActionCount: sortedDomains.filter(
      (domain) => domain.certificateChainAttentionStatus === 'action-needed'
    ).length,
    certificateChainAttentionPersistentCount: sortedDomains.filter(
      hasProjectDomainPersistentCertificateChainAttention
    ).length,
    certificateChainHistoryRotatedCount: sortedDomains.filter(
      (domain) => domain.certificateChainHistoryStatus === 'rotated'
    ).length,
    certificateChainHistoryIssueCount: sortedDomains.filter(
      hasProjectDomainCertificateChainHistoryIssue
    ).length,
    certificateChainHistoryBaselineMissingCount: sortedDomains.filter(
      (domain) => domain.certificateChainHistoryStatus === 'baseline-missing'
    ).length,
    certificateHistoryTrackedHostCount: sortedDomains.filter(
      (domain) => (domain.certificateHistorySummary?.eventCount ?? 0) > 0
    ).length,
    certificateHistoryIncidentCount: sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.incidentCount ?? 0),
      0
    ),
    certificateHistoryRecoveryCount: sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.recoveryCount ?? 0),
      0
    ),
    certificateHistoryPathWarningCount: sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.pathWarningCount ?? 0),
      0
    )
  };
}
