import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPrimaryProjectService, formatCertificateFingerprintPreview } from '@vcloudrunner/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionToast } from '@/components/action-toast';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { PageLayout } from '@/components/page-layout';
import { ProjectSubnav } from '@/components/project-subnav';
import {
  apiAuthToken,
  fetchProjectDomains,
  fetchProjectMembers,
  fetchProjectsForCurrentUser,
  type ApiProjectDomain,
  resolveViewerContext
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  createProjectDomainAction,
  refreshProjectDomainDiagnosticsAction,
  removeProjectDomainAction,
  verifyProjectDomainClaimAction
} from '@/app/projects/actions';
import {
  formatProjectDomainCertificateLabel,
  formatProjectDomainCertificateIdentityLabel,
  formatProjectDomainCertificateAttentionLabel,
  formatProjectDomainCertificateChainLabel,
  formatProjectDomainCertificateChainAttentionLabel,
  formatProjectDomainCertificateGuidanceLabel,
  formatProjectDomainCertificateChainHistoryLabel,
  formatProjectDomainCertificatePathValidityLabel,
  formatProjectDomainCertificateTrustLabel,
  formatProjectDomainCertificateValidityLabel,
  createExpectedProjectDomainHost,
  formatProjectDomainEventKindLabel,
  formatProjectDomainClaimLabel,
  formatProjectDomainEventStatusTransition,
  formatProjectDomainDiagnosticsFreshnessLabel,
  formatProjectDomainVerificationLabel,
  formatProjectDomainOwnershipLabel,
  formatProjectDomainTlsLabel,
  formatProjectRouteStatusLabel,
  hasProjectDomainCertificateIdentityAttention,
  hasProjectDomainPersistentCertificateAttention,
  hasProjectDomainPersistentCertificateChainAttention,
  hasProjectDomainCertificateChainHistoryIssue,
  hasProjectDomainCertificatePathValidityIssue,
  hasProjectDomainOwnershipDrift,
  hasProjectDomainRecentCertificateRotation,
  hasProjectDomainTlsRegression,
  projectDomainClaimVariant,
  projectDomainCertificateStateVariant,
  projectDomainCertificateIdentityVariant,
  projectDomainCertificateAttentionVariant,
  projectDomainCertificateChainVariant,
  projectDomainCertificateChainAttentionVariant,
  projectDomainCertificateGuidanceVariant,
  projectDomainCertificateChainHistoryVariant,
  projectDomainCertificatePathValidityVariant,
  projectDomainCertificateTrustVariant,
  projectDomainCertificateValidityVariant,
  projectDomainDiagnosticsFreshnessVariant,
  projectDomainVerificationStatusVariant,
  projectDomainOwnershipStatusVariant,
  projectDomainTlsStatusVariant,
  projectRouteStatusVariant,
  sortProjectDomainsForDisplay,
  summarizeProjectDomains
} from '@/lib/project-domains';
import { describeDashboardLiveDataFailure, formatRelativeTime, truncateUuid } from '@/lib/helpers';

interface ProjectDomainsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

function describeVerificationTimeline(domain: ApiProjectDomain): string | null {
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

function describeOwnershipTimeline(domain: ApiProjectDomain): string | null {
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

function describeTlsTimeline(domain: ApiProjectDomain): string | null {
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

function formatCertificateValidationReason(reason: ApiProjectDomain['certificateValidationReason']): string | null {
  if (!reason) {
    return null;
  }

  return reason.replace(/-/g, ' ');
}

function formatCertificateCoverageNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 4) {
    return names.join(', ');
  }

  return `${names.slice(0, 4).join(', ')} (+${names.length - 4} more)`;
}

function formatCertificateChainNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 4) {
    return names.join(' -> ');
  }

  return `${names.slice(0, 4).join(' -> ')} (+${names.length - 4} more)`;
}

function formatCertificateIntermediateNames(names: string[] | undefined): string | null {
  if (!names || names.length === 0) {
    return null;
  }

  if (names.length <= 3) {
    return names.join(', ');
  }

  return `${names.slice(0, 3).join(', ')} (+${names.length - 3} more)`;
}

function formatCertificateChainEntrySummary(
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

function getCertificateChainEntryValidityStatus(entry: {
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

function formatCertificateChainEntryValidity(entry: {
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

function describeCertificateIdentityTimeline(domain: ApiProjectDomain): string | null {
  if (domain.certificateLastRotatedAt) {
    return `Last certificate rotation recorded ${formatRelativeTime(domain.certificateLastRotatedAt)}.`;
  }

  if (domain.certificateFirstObservedAt) {
    return `Certificate identity first recorded ${formatRelativeTime(domain.certificateFirstObservedAt)}.`;
  }

  return null;
}

function describeCertificateAttentionTimeline(domain: ApiProjectDomain): string | null {
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

function describeCertificateChainTimeline(domain: ApiProjectDomain): string | null {
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

function describeCertificateChainHistoryTimeline(domain: ApiProjectDomain): string | null {
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

function describeCertificatePathValidityTimeline(domain: ApiProjectDomain): string | null {
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

function describeCertificateHistorySummary(domain: ApiProjectDomain): string | null {
  const summary = domain.certificateHistorySummary;
  if (!summary) {
    return null;
  }

  if (summary.eventCount === 0) {
    return 'No trust, issuer-path, chain, or certificate follow-up history has been recorded for this host yet.';
  }

  return `Tracked ${summary.eventCount} certificate history event${summary.eventCount === 1 ? '' : 's'}: ${summary.incidentCount} incident${summary.incidentCount === 1 ? '' : 's'}, ${summary.recoveryCount} recover${summary.recoveryCount === 1 ? 'y' : 'ies'}${summary.pathWarningCount > 0 ? `, and ${summary.pathWarningCount} issuer-path renewal warning${summary.pathWarningCount === 1 ? '' : 's'}` : ''}.`;
}

function describeCertificateHistoryBreakdown(domain: ApiProjectDomain): string | null {
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

function describeCertificateHistoryTimeline(domain: ApiProjectDomain): string | null {
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

export default async function ProjectDomainsPage({ params, searchParams }: ProjectDomainsPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/domains`}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForCurrentUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    const primaryService = getPrimaryProjectService(project.services);
    const expectedHost = createExpectedProjectDomainHost(project);

    let domains: Awaited<ReturnType<typeof fetchProjectDomains>> = [];
    let domainReadErrorMessage: string | null = null;
    let projectMembers: Awaited<ReturnType<typeof fetchProjectMembers>> = [];
    let projectMembersReadErrorMessage: string | null = null;

    try {
      domains = await fetchProjectDomains(project.id);
    } catch (error) {
      domainReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    try {
      projectMembers = await fetchProjectMembers(project.id);
    } catch (error) {
      projectMembersReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    const sortedDomains = sortProjectDomainsForDisplay(domains);
    const staleDiagnosticsCount = sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'stale'
    ).length;
    const uncheckedDiagnosticsCount = sortedDomains.filter(
      (domain) => domain.diagnosticsFreshnessStatus === 'unchecked'
    ).length;
    const ownershipDriftCount = sortedDomains.filter(hasProjectDomainOwnershipDrift).length;
    const tlsRegressionCount = sortedDomains.filter(hasProjectDomainTlsRegression).length;
    const certificateProvisioningCount = sortedDomains.filter(
      (domain) => domain.certificateState === 'provisioning'
    ).length;
    const certificateAttentionCount = sortedDomains.filter(
      (domain) =>
        domain.certificateState === 'issuance-attention'
        || domain.certificateState === 'renewal-attention'
    ).length;
    const certificateCheckUnavailableCount = sortedDomains.filter(
      (domain) => domain.certificateState === 'check-unavailable'
    ).length;
    const certificateExpiringSoonCount = sortedDomains.filter(
      (domain) => domain.certificateValidityStatus === 'expiring-soon'
    ).length;
    const certificateExpiredCount = sortedDomains.filter(
      (domain) =>
        domain.certificateValidityStatus === 'expired'
        || domain.certificateValidityStatus === 'not-yet-valid'
    ).length;
    const certificateDatesUnavailableCount = sortedDomains.filter(
      (domain) => domain.certificateValidityStatus === 'unavailable'
    ).length;
    const certificatePathExpiringSoonCount = sortedDomains.filter(
      (domain) => domain.certificatePathValidityStatus === 'expiring-soon'
    ).length;
    const certificatePathInvalidCount = sortedDomains.filter(
      hasProjectDomainCertificatePathValidityIssue
    ).length;
    const certificatePathUnavailableCount = sortedDomains.filter(
      (domain) => domain.certificatePathValidityStatus === 'unavailable'
    ).length;
    const certificateTrustIssueCount = sortedDomains.filter(
      (domain) =>
        domain.certificateTrustStatus === 'hostname-mismatch'
        || domain.certificateTrustStatus === 'self-signed'
        || domain.certificateTrustStatus === 'issuer-untrusted'
        || domain.certificateTrustStatus === 'validation-failed'
    ).length;
    const certificateFirstObservedCount = sortedDomains.filter(
      (domain) => domain.certificateIdentityStatus === 'first-observed'
    ).length;
    const certificateRotationCount = sortedDomains.filter(hasProjectDomainRecentCertificateRotation).length;
    const certificateRotationAttentionCount = sortedDomains.filter(
      hasProjectDomainCertificateIdentityAttention
    ).length;
    const certificateIdentityUnavailableCount = sortedDomains.filter(
      (domain) => domain.certificateIdentityStatus === 'unavailable'
    ).length;
    const certificateRenewSoonCount = sortedDomains.filter(
      (domain) => domain.certificateGuidanceState === 'renew-soon'
    ).length;
    const certificateRenewNowCount = sortedDomains.filter(
      (domain) => domain.certificateGuidanceState === 'renew-now'
    ).length;
    const certificateAttentionMonitorCount = sortedDomains.filter(
      (domain) => domain.certificateAttentionStatus === 'monitor'
    ).length;
    const certificateAttentionActionCount = sortedDomains.filter(
      (domain) => domain.certificateAttentionStatus === 'action-needed'
    ).length;
    const certificateAttentionPersistentCount = sortedDomains.filter(
      hasProjectDomainPersistentCertificateAttention
    ).length;
    const certificateChainCapturedCount = sortedDomains.filter(
      (domain) => domain.certificateChainStatus === 'chained'
    ).length;
    const certificateChainLeafOnlyCount = sortedDomains.filter(
      (domain) => domain.certificateChainStatus === 'leaf-only'
    ).length;
    const certificateChainIssueCount = sortedDomains.filter(
      (domain) =>
        domain.certificateChainStatus === 'incomplete'
        || domain.certificateChainStatus === 'private-root'
        || domain.certificateChainStatus === 'self-signed-leaf'
    ).length;
    const certificateChainAttentionMonitorCount = sortedDomains.filter(
      (domain) => domain.certificateChainAttentionStatus === 'monitor'
    ).length;
    const certificateChainAttentionActionCount = sortedDomains.filter(
      (domain) => domain.certificateChainAttentionStatus === 'action-needed'
    ).length;
    const certificateChainAttentionPersistentCount = sortedDomains.filter(
      hasProjectDomainPersistentCertificateChainAttention
    ).length;
    const certificateChainHistoryRotatedCount = sortedDomains.filter(
      (domain) => domain.certificateChainHistoryStatus === 'rotated'
    ).length;
    const certificateChainHistoryIssueCount = sortedDomains.filter(
      hasProjectDomainCertificateChainHistoryIssue
    ).length;
    const certificateChainHistoryBaselineMissingCount = sortedDomains.filter(
      (domain) => domain.certificateChainHistoryStatus === 'baseline-missing'
    ).length;
    const certificateHistoryTrackedHostCount = sortedDomains.filter(
      (domain) => (domain.certificateHistorySummary?.eventCount ?? 0) > 0
    ).length;
    const certificateHistoryIncidentCount = sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.incidentCount ?? 0),
      0
    );
    const certificateHistoryRecoveryCount = sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.recoveryCount ?? 0),
      0
    );
    const certificateHistoryPathWarningCount = sortedDomains.reduce(
      (total, domain) => total + (domain.certificateHistorySummary?.pathWarningCount ?? 0),
      0
    );
    const routeSummary = summarizeProjectDomains({
      project,
      domains: sortedDomains,
      domainsUnavailable: Boolean(domainReadErrorMessage)
    });
    const currentViewerMembership = projectMembers.find((member) => member.userId === viewer.userId) ?? null;
    const canManageDomains =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
        || currentViewerMembership?.role === 'admin'
      );

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Domains</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Project Domains</h1>
              <p className="text-sm text-muted-foreground">
                Published hosts and routing health for <span className="font-medium text-foreground">{project.name}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={routeSummary.variant}>{routeSummary.label}</Badge>
              <span className="font-mono text-sm text-primary">{routeSummary.host}</span>
              <Badge variant={primaryService.exposure === 'public' ? 'default' : 'secondary'}>
                public service: {primaryService.name}
              </Badge>
            </div>
          </div>
          <form action={refreshProjectDomainDiagnosticsAction} className="flex items-center gap-2">
            <input type="hidden" name="projectId" value={project.id} readOnly />
            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
            <FormSubmitButton
              idleText="Refresh Checks"
              pendingText="Refreshing..."
              variant="outline"
            />
          </form>
        </div>

        <ProjectSubnav projectId={project.id} />

        {domainReadErrorMessage ? (
          <DemoModeBanner title="Partial outage" detail={domainReadErrorMessage}>
            Domain and routing status is temporarily unavailable.
          </DemoModeBanner>
        ) : null}

        {projectMembersReadErrorMessage ? (
          <DemoModeBanner title="Permission visibility degraded" detail={projectMembersReadErrorMessage}>
            Domain records are still visible, but domain-management controls may be limited until project membership data reloads.
          </DemoModeBanner>
        ) : null}

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Project domain operation failed."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Route Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{routeSummary.detail}</p>
            <p className="text-xs text-muted-foreground">
              Expected default host: <span className="font-mono text-foreground">{expectedHost}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Public routes are currently tied to the project&apos;s public web service and become visible here after successful deploys.
            </p>
            <p className="text-xs text-muted-foreground">
              Stored claim-verification, DNS, and TLS checks below refresh automatically in the background and can also be refreshed on demand. Active custom domains can be detached here immediately, while newly claimed hosts still become live on the next successful deployment of the public service.
            </p>
            {staleDiagnosticsCount > 0 || uncheckedDiagnosticsCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Diagnostics attention:
                {' '}
                {staleDiagnosticsCount > 0 ? `${staleDiagnosticsCount} stale` : '0 stale'}
                {uncheckedDiagnosticsCount > 0
                  ? `, ${uncheckedDiagnosticsCount} not yet recorded`
                  : ', 0 not yet recorded'}
                .
              </p>
            ) : null}
            {ownershipDriftCount > 0 || tlsRegressionCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Drift attention:
                {' '}
                {ownershipDriftCount > 0 ? `${ownershipDriftCount} DNS drifted` : '0 DNS drifted'}
                {tlsRegressionCount > 0
                  ? `, ${tlsRegressionCount} HTTPS regressions since last healthy`
                  : ', 0 HTTPS regressions since last healthy'}
                .
              </p>
            ) : null}
            {certificateProvisioningCount > 0 || certificateAttentionCount > 0 || certificateCheckUnavailableCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate attention:
                {' '}
                {certificateProvisioningCount > 0 ? `${certificateProvisioningCount} provisioning` : '0 provisioning'}
                {certificateAttentionCount > 0
                  ? `, ${certificateAttentionCount} need review`
                  : ', 0 need review'}
                {certificateCheckUnavailableCount > 0
                  ? `, ${certificateCheckUnavailableCount} checks unavailable`
                  : ', 0 checks unavailable'}
                .
              </p>
            ) : null}
            {certificateExpiringSoonCount > 0 || certificateExpiredCount > 0 || certificateDatesUnavailableCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate dates:
                {' '}
                {certificateExpiringSoonCount > 0 ? `${certificateExpiringSoonCount} expiring soon` : '0 expiring soon'}
                {certificateExpiredCount > 0
                  ? `, ${certificateExpiredCount} expired or not yet valid`
                  : ', 0 expired or not yet valid'}
                {certificateDatesUnavailableCount > 0
                  ? `, ${certificateDatesUnavailableCount} unavailable`
                  : ', 0 unavailable'}
                .
              </p>
            ) : null}
            {certificatePathExpiringSoonCount > 0
            || certificatePathInvalidCount > 0
            || certificatePathUnavailableCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Issuer-path dates:
                {' '}
                {certificatePathExpiringSoonCount > 0
                  ? `${certificatePathExpiringSoonCount} nearing expiry`
                  : '0 nearing expiry'}
                {certificatePathInvalidCount > 0
                  ? `, ${certificatePathInvalidCount} regressed`
                  : ', 0 regressed'}
                {certificatePathUnavailableCount > 0
                  ? `, ${certificatePathUnavailableCount} unavailable`
                  : ', 0 unavailable'}
                .
              </p>
            ) : null}
            {certificateTrustIssueCount > 0 || certificateRenewSoonCount > 0 || certificateRenewNowCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate guidance:
                {' '}
                {certificateTrustIssueCount > 0 ? `${certificateTrustIssueCount} trust or coverage issues` : '0 trust or coverage issues'}
                {certificateRenewSoonCount > 0
                  ? `, ${certificateRenewSoonCount} nearing renewal`
                  : ', 0 nearing renewal'}
                {certificateRenewNowCount > 0
                  ? `, ${certificateRenewNowCount} need immediate renewal review`
                  : ', 0 need immediate renewal review'}
                .
              </p>
            ) : null}
            {certificateAttentionMonitorCount > 0
            || certificateAttentionActionCount > 0
            || certificateAttentionPersistentCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate follow-up:
                {' '}
                {certificateAttentionMonitorCount > 0
                  ? `${certificateAttentionMonitorCount} monitor`
                  : '0 monitor'}
                {certificateAttentionActionCount > 0
                  ? `, ${certificateAttentionActionCount} need action`
                  : ', 0 need action'}
                {certificateAttentionPersistentCount > 0
                  ? `, ${certificateAttentionPersistentCount} persistent issues`
                  : ', 0 persistent issues'}
                .
              </p>
            ) : null}
            {certificateChainCapturedCount > 0
            || certificateChainLeafOnlyCount > 0
            || certificateChainIssueCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate chain:
                {' '}
                {certificateChainCapturedCount > 0
                  ? `${certificateChainCapturedCount} captured`
                  : '0 captured'}
                {certificateChainLeafOnlyCount > 0
                  ? `, ${certificateChainLeafOnlyCount} leaf-only`
                  : ', 0 leaf-only'}
                {certificateChainIssueCount > 0
                  ? `, ${certificateChainIssueCount} need review`
                  : ', 0 need review'}
                .
              </p>
            ) : null}
            {certificateChainAttentionMonitorCount > 0
            || certificateChainAttentionActionCount > 0
            || certificateChainAttentionPersistentCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Chain follow-up:
                {' '}
                {certificateChainAttentionMonitorCount > 0
                  ? `${certificateChainAttentionMonitorCount} monitor`
                  : '0 monitor'}
                {certificateChainAttentionActionCount > 0
                  ? `, ${certificateChainAttentionActionCount} need action`
                  : ', 0 need action'}
                {certificateChainAttentionPersistentCount > 0
                  ? `, ${certificateChainAttentionPersistentCount} persistent issues`
                  : ', 0 persistent issues'}
                .
              </p>
            ) : null}
            {certificateChainHistoryRotatedCount > 0
            || certificateChainHistoryIssueCount > 0
            || certificateChainHistoryBaselineMissingCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Chain history:
                {' '}
                {certificateChainHistoryRotatedCount > 0
                  ? `${certificateChainHistoryRotatedCount} healthy path changes`
                  : '0 healthy path changes'}
                {certificateChainHistoryIssueCount > 0
                  ? `, ${certificateChainHistoryIssueCount} incident regressions`
                  : ', 0 incident regressions'}
                {certificateChainHistoryBaselineMissingCount > 0
                  ? `, ${certificateChainHistoryBaselineMissingCount} missing healthy baseline`
                  : ', 0 missing healthy baseline'}
                .
              </p>
            ) : null}
            {certificateFirstObservedCount > 0
            || certificateRotationCount > 0
            || certificateIdentityUnavailableCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate identity:
                {' '}
                {certificateFirstObservedCount > 0
                  ? `${certificateFirstObservedCount} first observed`
                  : '0 first observed'}
                {certificateRotationCount > 0
                  ? `, ${certificateRotationCount} recent rotations`
                  : ', 0 recent rotations'}
                {certificateRotationAttentionCount > 0
                  ? `, ${certificateRotationAttentionCount} rotations need review`
                  : ', 0 rotations need review'}
                {certificateIdentityUnavailableCount > 0
                  ? `, ${certificateIdentityUnavailableCount} missing identity capture`
                  : ', 0 missing identity capture'}
                .
              </p>
            ) : null}
            {certificateHistoryTrackedHostCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Certificate history:
                {' '}
                {certificateHistoryTrackedHostCount} host{certificateHistoryTrackedHostCount === 1 ? '' : 's'} with tracked history,
                {' '}
                {certificateHistoryIncidentCount} incident{certificateHistoryIncidentCount === 1 ? '' : 's'},
                {' '}
                {certificateHistoryRecoveryCount} recover{certificateHistoryRecoveryCount === 1 ? 'y' : 'ies'}
                {certificateHistoryPathWarningCount > 0
                  ? `, ${certificateHistoryPathWarningCount} issuer-path renewal warning${certificateHistoryPathWarningCount === 1 ? '' : 's'}`
                  : ', 0 issuer-path renewal warnings'}
                .
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canManageDomains ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Custom Domain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={createProjectDomainAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input type="hidden" name="projectId" value={project.id} readOnly />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="project-domain-host" className="sr-only">Custom domain host</Label>
                  <Input
                    id="project-domain-host"
                    name="host"
                    type="text"
                    required
                    placeholder="api.example.com"
                    className="font-mono"
                  />
                </div>
                <FormSubmitButton
                  idleText="Add Domain"
                  pendingText="Saving..."
                  className="md:self-end"
                />
              </form>
              <p className="text-xs text-muted-foreground">
                Use an external hostname like <span className="font-mono text-foreground">api.example.com</span>. Platform-managed hosts under <span className="font-mono text-foreground">{expectedHost}</span> stay reserved and do not need to be added here.
              </p>
              <p className="text-xs text-muted-foreground">
                New custom hosts start with a TXT ownership challenge. Once the claim verifies and routing DNS is pointed at the platform target, the host still becomes live on the next successful deployment of the public service.
              </p>
            </CardContent>
          </Card>
        ) : viewer.user ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Add Custom Domain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Domain management currently requires owner, admin, or project-admin access.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {domainReadErrorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Published Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Project domains unavailable</p>
                <p className="mt-1 text-xs">{domainReadErrorMessage}</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedDomains.length === 0 ? (
          <EmptyState
            title="No published routes yet"
            description={`Deploy the public service "${primaryService.name}" successfully to publish ${expectedHost}.`}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Published Routes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedDomains.map((domain) => {
                const isCustomHost = domain.host !== expectedHost;
                const hasInFlightRouteAttachment =
                  domain.deploymentStatus === 'queued'
                  || domain.deploymentStatus === 'building';
                const canRemoveDomain = canManageDomains && isCustomHost && !hasInFlightRouteAttachment;

                return (
                  <div
                    key={domain.id}
                    className="rounded-md border px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm text-primary">{domain.host}</p>
                          <Badge variant={projectRouteStatusVariant(domain.routeStatus)}>
                            {formatProjectRouteStatusLabel(domain.routeStatus)}
                          </Badge>
                          {domain.serviceName ? (
                            <Badge variant="outline">{domain.serviceName}</Badge>
                          ) : null}
                          {domain.serviceKind ? (
                            <Badge variant="secondary">{domain.serviceKind}</Badge>
                          ) : null}
                          {domain.serviceExposure ? (
                            <Badge variant={domain.serviceExposure === 'public' ? 'default' : 'secondary'}>
                              {domain.serviceExposure}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">
                            {isCustomHost ? 'custom host' : 'default host'}
                          </Badge>
                          {domain.deploymentStatus ? (
                            <DeploymentStatusBadges status={domain.deploymentStatus} />
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{domain.statusDetail}</p>
                          {domain.ownershipStatus ? (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {domain.verificationStatus ? (
                              <Badge variant={projectDomainVerificationStatusVariant(domain.verificationStatus)}>
                                {formatProjectDomainVerificationLabel(domain.verificationStatus)}
                              </Badge>
                            ) : null}
                            <Badge variant={projectDomainOwnershipStatusVariant(domain.ownershipStatus)}>
                              {formatProjectDomainOwnershipLabel(domain.ownershipStatus)}
                            </Badge>
                            {domain.tlsStatus ? (
                              <Badge variant={projectDomainTlsStatusVariant(domain.tlsStatus)}>
                                {formatProjectDomainTlsLabel(domain.tlsStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateState ? (
                              <Badge variant={projectDomainCertificateStateVariant(domain.certificateState)}>
                                {formatProjectDomainCertificateLabel(domain.certificateState)}
                              </Badge>
                            ) : null}
                            {domain.certificateValidityStatus ? (
                              <Badge variant={projectDomainCertificateValidityVariant(domain.certificateValidityStatus)}>
                                {formatProjectDomainCertificateValidityLabel(domain.certificateValidityStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateTrustStatus ? (
                              <Badge variant={projectDomainCertificateTrustVariant(domain.certificateTrustStatus)}>
                                {formatProjectDomainCertificateTrustLabel(domain.certificateTrustStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateIdentityStatus ? (
                              <Badge variant={projectDomainCertificateIdentityVariant(domain.certificateIdentityStatus)}>
                                {formatProjectDomainCertificateIdentityLabel(domain.certificateIdentityStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateGuidanceState ? (
                              <Badge variant={projectDomainCertificateGuidanceVariant(domain.certificateGuidanceState)}>
                                {formatProjectDomainCertificateGuidanceLabel(domain.certificateGuidanceState)}
                              </Badge>
                            ) : null}
                            {domain.certificateAttentionStatus ? (
                              <Badge variant={projectDomainCertificateAttentionVariant(domain.certificateAttentionStatus)}>
                                {formatProjectDomainCertificateAttentionLabel(domain.certificateAttentionStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateChainStatus ? (
                              <Badge variant={projectDomainCertificateChainVariant(domain.certificateChainStatus)}>
                                {formatProjectDomainCertificateChainLabel(domain.certificateChainStatus)}
                              </Badge>
                            ) : null}
                            {domain.certificateChainAttentionStatus ? (
                              <Badge
                                variant={projectDomainCertificateChainAttentionVariant(
                                  domain.certificateChainAttentionStatus
                                )}
                              >
                                {formatProjectDomainCertificateChainAttentionLabel(
                                  domain.certificateChainAttentionStatus
                                )}
                              </Badge>
                            ) : null}
                            {domain.certificateChainHistoryStatus ? (
                              <Badge
                                variant={projectDomainCertificateChainHistoryVariant(
                                  domain.certificateChainHistoryStatus
                                )}
                              >
                                {formatProjectDomainCertificateChainHistoryLabel(
                                  domain.certificateChainHistoryStatus
                                )}
                              </Badge>
                            ) : null}
                            {domain.certificatePathValidityStatus ? (
                              <Badge
                                variant={projectDomainCertificatePathValidityVariant(
                                  domain.certificatePathValidityStatus
                                )}
                              >
                                {formatProjectDomainCertificatePathValidityLabel(
                                  domain.certificatePathValidityStatus
                                )}
                              </Badge>
                            ) : null}
                            {domain.diagnosticsFreshnessStatus ? (
                              <Badge variant={projectDomainDiagnosticsFreshnessVariant(domain.diagnosticsFreshnessStatus)}>
                                {formatProjectDomainDiagnosticsFreshnessLabel(domain.diagnosticsFreshnessStatus)}
                              </Badge>
                            ) : null}
                            {domain.claimState ? (
                              <Badge variant={projectDomainClaimVariant(domain.claimState)}>
                                {formatProjectDomainClaimLabel(domain.claimState)}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                        {domain.claimTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Claim guide: {domain.claimTitle}
                          </p>
                        ) : null}
                        {domain.claimDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.claimDetail}</p>
                        ) : null}
                        {domain.certificateTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Certificate lifecycle: {domain.certificateTitle}
                          </p>
                        ) : null}
                        {domain.certificateDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateDetail}</p>
                        ) : null}
                        {domain.certificateValidityDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateValidityDetail}</p>
                        ) : null}
                        {domain.certificateTrustDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateTrustDetail}</p>
                        ) : null}
                        {domain.certificateIdentityTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Certificate identity: {domain.certificateIdentityTitle}
                          </p>
                        ) : null}
                        {domain.certificateIdentityDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateIdentityDetail}</p>
                        ) : null}
                        {domain.certificateGuidanceTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Certificate next step: {domain.certificateGuidanceTitle}
                          </p>
                        ) : null}
                        {domain.certificateGuidanceDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateGuidanceDetail}</p>
                        ) : null}
                        {domain.certificateAttentionTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Certificate follow-up: {domain.certificateAttentionTitle}
                          </p>
                        ) : null}
                        {domain.certificateAttentionDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateAttentionDetail}</p>
                        ) : null}
                        {domain.certificateChainTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Certificate chain: {domain.certificateChainTitle}
                          </p>
                        ) : null}
                        {domain.certificateChainDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateChainDetail}</p>
                        ) : null}
                        {domain.certificateChainAttentionTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Chain follow-up: {domain.certificateChainAttentionTitle}
                          </p>
                        ) : null}
                        {domain.certificateChainAttentionDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateChainAttentionDetail}</p>
                        ) : null}
                        {domain.certificateChainHistoryTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Chain history: {domain.certificateChainHistoryTitle}
                          </p>
                        ) : null}
                        {domain.certificateChainHistoryDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificateChainHistoryDetail}</p>
                        ) : null}
                        {domain.certificatePathValidityTitle ? (
                          <p className="text-xs font-medium text-foreground">
                            Issuer-path dates: {domain.certificatePathValidityTitle}
                          </p>
                        ) : null}
                        {domain.certificatePathValidityDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.certificatePathValidityDetail}</p>
                        ) : null}
                        {domain.verificationDnsRecordType && domain.verificationDnsRecordName && domain.verificationDnsRecordValue ? (
                          <p className="text-xs text-muted-foreground">
                            Ownership challenge record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.verificationDnsRecordType} {domain.verificationDnsRecordName} -&gt; {domain.verificationDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.routingDnsRecordType && domain.routingDnsRecordName && domain.routingDnsRecordValue ? (
                          <p className="text-xs text-muted-foreground">
                            Routing DNS record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.routingDnsRecordType} {domain.routingDnsRecordName} -&gt; {domain.routingDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.claimDnsRecordType
                        && domain.claimDnsRecordName
                        && domain.claimDnsRecordValue
                        && (
                          domain.claimDnsRecordType !== domain.verificationDnsRecordType
                          || domain.claimDnsRecordName !== domain.verificationDnsRecordName
                          || domain.claimDnsRecordValue !== domain.verificationDnsRecordValue
                        )
                        && (
                          domain.claimDnsRecordType !== domain.routingDnsRecordType
                          || domain.claimDnsRecordName !== domain.routingDnsRecordName
                          || domain.claimDnsRecordValue !== domain.routingDnsRecordValue
                        ) ? (
                          <p className="text-xs text-muted-foreground">
                            Recommended DNS record:{' '}
                            <span className="font-mono text-foreground">
                              {domain.claimDnsRecordType} {domain.claimDnsRecordName} -&gt; {domain.claimDnsRecordValue}
                            </span>
                          </p>
                        ) : null}
                        {domain.ownershipDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.ownershipDetail}</p>
                        ) : null}
                        {domain.verificationDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.verificationDetail}</p>
                        ) : null}
                        {domain.tlsDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.tlsDetail}</p>
                        ) : null}
                        {domain.diagnosticsFreshnessDetail ? (
                          <p className="text-xs text-muted-foreground">{domain.diagnosticsFreshnessDetail}</p>
                        ) : null}
                        {describeVerificationTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeVerificationTimeline(domain)}</p>
                        ) : null}
                        {describeOwnershipTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeOwnershipTimeline(domain)}</p>
                        ) : null}
                        {describeTlsTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeTlsTimeline(domain)}</p>
                        ) : null}
                        {describeCertificateIdentityTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeCertificateIdentityTimeline(domain)}</p>
                        ) : null}
                        {describeCertificateAttentionTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeCertificateAttentionTimeline(domain)}</p>
                        ) : null}
                        {describeCertificateChainTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeCertificateChainTimeline(domain)}</p>
                        ) : null}
                        {describeCertificateChainHistoryTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeCertificateChainHistoryTimeline(domain)}</p>
                        ) : null}
                        {describeCertificatePathValidityTimeline(domain) ? (
                          <p className="text-xs text-muted-foreground">{describeCertificatePathValidityTimeline(domain)}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {domain.diagnosticsCheckedAt
                            ? `Checks last ran ${formatRelativeTime(domain.diagnosticsCheckedAt)}`
                            : 'Checks not recorded yet. Refresh checks to persist claim-verification, DNS, and TLS status for this host.'}
                        </p>
                        {domain.verificationVerifiedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Ownership claim last confirmed {formatRelativeTime(domain.verificationVerifiedAt)}
                          </p>
                        ) : null}
                        {domain.ownershipVerifiedAt ? (
                          <p className="text-xs text-muted-foreground">
                            DNS last confirmed {formatRelativeTime(domain.ownershipVerifiedAt)}
                          </p>
                        ) : null}
                        {domain.tlsReadyAt ? (
                          <p className="text-xs text-muted-foreground">
                            HTTPS last healthy {formatRelativeTime(domain.tlsReadyAt)}
                          </p>
                        ) : null}
                        {domain.certificateValidFrom ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate valid from {formatRelativeTime(domain.certificateValidFrom)}
                          </p>
                        ) : null}
                        {domain.certificateValidTo ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate valid until {formatRelativeTime(domain.certificateValidTo)}
                          </p>
                        ) : null}
                        {domain.certificateFirstObservedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate identity first observed {formatRelativeTime(domain.certificateFirstObservedAt)}
                          </p>
                        ) : null}
                        {domain.certificateChangedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate identity last changed {formatRelativeTime(domain.certificateChangedAt)}
                          </p>
                        ) : null}
                        {domain.certificateLastRotatedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate last rotated {formatRelativeTime(domain.certificateLastRotatedAt)}
                          </p>
                        ) : null}
                        {domain.certificateIssuerName ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate issuer: <span className="text-foreground">{domain.certificateIssuerName}</span>
                          </p>
                        ) : null}
                        {domain.certificateRootSubjectName ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate root: <span className="text-foreground">{domain.certificateRootSubjectName}</span>
                          </p>
                        ) : null}
                        {(domain.certificateChainDepth ?? 0) > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Presented chain depth: <span className="text-foreground">{domain.certificateChainDepth}</span>
                          </p>
                        ) : null}
                        {formatCertificateIntermediateNames(domain.certificateIntermediateSubjectNames) ? (
                          <p className="text-xs text-muted-foreground">
                            Intermediate issuers:{' '}
                            <span className="text-foreground">
                              {formatCertificateIntermediateNames(domain.certificateIntermediateSubjectNames)}
                            </span>
                          </p>
                        ) : null}
                        {domain.certificateSubjectName ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate subject: <span className="text-foreground">{domain.certificateSubjectName}</span>
                          </p>
                        ) : null}
                        {formatCertificateCoverageNames(domain.certificateSubjectAltNames) ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate coverage: <span className="text-foreground">{formatCertificateCoverageNames(domain.certificateSubjectAltNames)}</span>
                          </p>
                        ) : null}
                        {formatCertificateChainNames(domain.certificateChainSubjects) ? (
                          <p className="text-xs text-muted-foreground">
                            Presented chain: <span className="text-foreground">{formatCertificateChainNames(domain.certificateChainSubjects)}</span>
                          </p>
                        ) : null}
                        {domain.certificateChainEntries && domain.certificateChainEntries.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">Presented certificates</p>
                            {domain.certificateChainEntries.map((_, index) => {
                              const label = formatCertificateChainEntrySummary(domain.certificateChainEntries, index);
                              return label ? (
                                <p key={`current-chain-entry-${domain.id}-${index}`} className="text-xs text-muted-foreground">
                                  {label}
                                </p>
                              ) : null;
                            })}
                          </div>
                        ) : null}
                        {domain.certificateLastHealthyChainEntries
                        && domain.certificateLastHealthyChainEntries.length > 0
                        && domain.certificateChainHistoryStatus
                        && domain.certificateChainHistoryStatus !== 'stable' ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-foreground">Last healthy chain snapshot</p>
                            {domain.certificateLastHealthyChainEntries.map((_, index) => {
                              const label = formatCertificateChainEntrySummary(
                                domain.certificateLastHealthyChainEntries,
                                index
                              );
                              return label ? (
                                <p key={`healthy-chain-entry-${domain.id}-${index}`} className="text-xs text-muted-foreground">
                                  {label}
                                </p>
                              ) : null;
                            })}
                          </div>
                        ) : null}
                        {domain.certificateChainLastHealthyAt ? (
                          <p className="text-xs text-muted-foreground">
                            Full presented chain last healthy {formatRelativeTime(domain.certificateChainLastHealthyAt)}
                          </p>
                        ) : null}
                        {formatCertificateFingerprintPreview(domain.certificateFingerprintSha256) ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate fingerprint:{' '}
                            <span className="font-mono text-foreground">
                              {formatCertificateFingerprintPreview(domain.certificateFingerprintSha256)}
                            </span>
                          </p>
                        ) : null}
                        {domain.certificateSerialNumber ? (
                          <p className="text-xs text-muted-foreground">
                            Certificate serial: <span className="font-mono text-foreground">{domain.certificateSerialNumber}</span>
                          </p>
                        ) : null}
                        {formatCertificateValidationReason(domain.certificateValidationReason) ? (
                          <p className="text-xs text-muted-foreground">
                            Last validation reason:{' '}
                            <span className="text-foreground">
                              {formatCertificateValidationReason(domain.certificateValidationReason)}
                            </span>
                          </p>
                        ) : null}
                        {describeCertificateHistorySummary(domain) ? (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-foreground">Certificate history</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {describeCertificateHistorySummary(domain)}
                            </p>
                            {describeCertificateHistoryBreakdown(domain) ? (
                              <p className="text-xs text-muted-foreground">
                                {describeCertificateHistoryBreakdown(domain)}
                              </p>
                            ) : null}
                            {describeCertificateHistoryTimeline(domain) ? (
                              <p className="text-xs text-muted-foreground">
                                {describeCertificateHistoryTimeline(domain)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {domain.recentEvents && domain.recentEvents.length > 0 ? (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-foreground">Recent activity</p>
                            <div className="mt-1 space-y-1">
                              {domain.recentEvents.map((event) => (
                                <div key={event.id} className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      {formatProjectDomainEventKindLabel(event.kind)}
                                    </span>
                                    {' '}
                                    {formatProjectDomainEventStatusTransition({
                                      previousStatus: event.previousStatus,
                                      nextStatus: event.nextStatus
                                    })}
                                    {' '}
                                    {formatRelativeTime(event.createdAt)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          Target port: <span className="font-mono text-foreground">{domain.targetPort}</span>
                          {domain.deploymentId ? (
                            <>
                              {' '}| deployment{' '}
                              <Link
                                href={`/deployments/${domain.deploymentId}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {truncateUuid(domain.deploymentId)}
                              </Link>
                            </>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatRelativeTime(domain.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageDomains && isCustomHost ? (
                          <form action={verifyProjectDomainClaimAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="domainId" value={domain.id} readOnly />
                            <input type="hidden" name="domainHost" value={domain.host} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                            <FormSubmitButton
                              idleText={domain.verificationStatus === 'verified' ? 'Recheck Claim' : 'Verify Claim'}
                              pendingText="Verifying..."
                              size="sm"
                              variant="outline"
                            />
                          </form>
                        ) : null}
                        {domain.runtimeUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={domain.runtimeUrl} target="_blank" rel="noreferrer">
                              Open Runtime URL
                            </a>
                          </Button>
                        ) : domain.routeStatus === 'pending' ? (
                          <Badge variant="outline">pending activation</Badge>
                        ) : (
                          <Badge variant="outline">runtime URL unavailable</Badge>
                        )}
                        {canRemoveDomain ? (
                          <form action={removeProjectDomainAction}>
                            <input type="hidden" name="projectId" value={project.id} readOnly />
                            <input type="hidden" name="domainId" value={domain.id} readOnly />
                            <input type="hidden" name="domainHost" value={domain.host} readOnly />
                            <input type="hidden" name="returnPath" value={`/projects/${project.id}/domains`} readOnly />
                            <FormSubmitButton
                              idleText="Remove"
                              pendingText="Removing..."
                              size="sm"
                              variant="destructive"
                            />
                          </form>
                        ) : canManageDomains && isCustomHost && hasInFlightRouteAttachment ? (
                          <Badge variant="outline">remove after deployment finishes</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Project domains unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}/domains`}
        />
      </PageLayout>
    );
  }
}
