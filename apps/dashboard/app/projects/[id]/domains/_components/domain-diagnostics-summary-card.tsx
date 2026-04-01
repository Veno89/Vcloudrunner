import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DomainDiagnosticsSummary } from '@/lib/domain-diagnostics-helpers';

interface DomainDiagnosticsSummaryCardProps {
  summary: DomainDiagnosticsSummary;
  routeSummaryDetail: string;
  expectedHost: string;
}

export function DomainDiagnosticsSummaryCard({
  summary,
  routeSummaryDetail,
  expectedHost
}: DomainDiagnosticsSummaryCardProps) {
  const {
    staleDiagnosticsCount,
    uncheckedDiagnosticsCount,
    ownershipDriftCount,
    tlsRegressionCount,
    certificateProvisioningCount,
    certificateAttentionCount,
    certificateCheckUnavailableCount,
    certificateExpiringSoonCount,
    certificateExpiredCount,
    certificateDatesUnavailableCount,
    certificatePathExpiringSoonCount,
    certificatePathInvalidCount,
    certificatePathUnavailableCount,
    certificateTrustIssueCount,
    certificateRenewSoonCount,
    certificateRenewNowCount,
    certificateAttentionMonitorCount,
    certificateAttentionActionCount,
    certificateAttentionPersistentCount,
    certificateChainCapturedCount,
    certificateChainLeafOnlyCount,
    certificateChainIssueCount,
    certificateChainAttentionMonitorCount,
    certificateChainAttentionActionCount,
    certificateChainAttentionPersistentCount,
    certificateChainHistoryRotatedCount,
    certificateChainHistoryIssueCount,
    certificateChainHistoryBaselineMissingCount,
    certificateFirstObservedCount,
    certificateRotationCount,
    certificateRotationAttentionCount,
    certificateIdentityUnavailableCount,
    certificateHistoryTrackedHostCount,
    certificateHistoryIncidentCount,
    certificateHistoryRecoveryCount,
    certificateHistoryPathWarningCount
  } = summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Route Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{routeSummaryDetail}</p>
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
  );
}
