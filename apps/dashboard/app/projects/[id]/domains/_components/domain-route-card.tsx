import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { FormSubmitButton } from '@/components/form-submit-button';
import type { ApiProjectDomain } from '@/lib/api';
import {
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
  formatProjectDomainEventKindLabel,
  formatProjectDomainClaimLabel,
  formatProjectDomainEventStatusTransition,
  formatProjectDomainDiagnosticsFreshnessLabel,
  formatProjectDomainVerificationLabel,
  formatProjectDomainOwnershipLabel,
  formatProjectDomainTlsLabel,
  formatProjectRouteStatusLabel,
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
  projectRouteStatusVariant
} from '@/lib/project-domains';
import { formatRelativeTime, truncateUuid } from '@/lib/helpers';
import { formatCertificateFingerprintPreview } from '@vcloudrunner/shared-types';
import {
  describeVerificationTimeline,
  describeOwnershipTimeline,
  describeTlsTimeline,
  describeCertificateIdentityTimeline,
  describeCertificateAttentionTimeline,
  describeCertificateChainTimeline,
  describeCertificateChainHistoryTimeline,
  describeCertificatePathValidityTimeline,
  describeCertificateHistorySummary,
  describeCertificateHistoryBreakdown,
  describeCertificateHistoryTimeline,
  formatCertificateValidationReason,
  formatCertificateCoverageNames,
  formatCertificateChainNames,
  formatCertificateIntermediateNames,
  formatCertificateChainEntrySummary
} from '@/lib/domain-diagnostics-helpers';

interface DomainRouteCardProps {
  domain: ApiProjectDomain;
  expectedHost: string;
  projectId: string;
  canManageDomains: boolean;
}

export function DomainRouteCard({
  domain,
  expectedHost,
  projectId,
  canManageDomains
}: DomainRouteCardProps) {
  const isCustomHost = domain.host !== expectedHost;
  const hasInFlightRouteAttachment =
    domain.deploymentStatus === 'queued'
    || domain.deploymentStatus === 'building';
  const canRemoveDomain = canManageDomains && isCustomHost && !hasInFlightRouteAttachment;

  return (
    <div className="rounded-md border px-3 py-3">
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
              <input type="hidden" name="projectId" value={projectId} readOnly />
              <input type="hidden" name="domainId" value={domain.id} readOnly />
              <input type="hidden" name="domainHost" value={domain.host} readOnly />
              <input type="hidden" name="returnPath" value={`/projects/${projectId}/domains`} readOnly />
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
              <input type="hidden" name="projectId" value={projectId} readOnly />
              <input type="hidden" name="domainId" value={domain.id} readOnly />
              <input type="hidden" name="domainHost" value={domain.host} readOnly />
              <input type="hidden" name="returnPath" value={`/projects/${projectId}/domains`} readOnly />
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
}
