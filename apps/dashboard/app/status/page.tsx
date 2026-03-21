import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { PageLayout } from '@/components/page-layout';
import { PageHeader } from '@/components/page-header';
import { PlatformStatusStrip } from '@/components/platform-status-strip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadDashboardData } from '@/lib/loaders';
import { hasRequestedCancellation, truncateUuid } from '@/lib/helpers';
import { StatusQueueTrend } from '@/components/status-queue-trend';

export default async function StatusPage() {
  const data = await loadDashboardData();
  const recent = data.sortedDeployments.slice(0, 20);
  const terminalOutcomes = recent.filter(
    (item) =>
      item.deployment.status === 'running'
      || item.deployment.status === 'failed'
      || item.deployment.status === 'stopped'
  );
  const successful = terminalOutcomes.filter((item) => item.deployment.status === 'running').length;
  const successRate =
    terminalOutcomes.length > 0 ? Math.round((successful / terminalOutcomes.length) * 100) : null;
  const deploymentHistoryUnavailable =
    (!data.usingLiveData && Boolean(data.liveDataErrorMessage)) ||
    (data.usingLiveData && recent.length === 0 && Boolean(data.liveDataErrorMessage));
  const deploymentHistoryPartial =
    data.usingLiveData && Boolean(data.liveDataErrorMessage) && !deploymentHistoryUnavailable;

  return (
    <PageLayout>
      <PageHeader
        title="Operational Status"
        description="Queue pressure, worker/API health, and recent deployment outcomes."
      />

      <PlatformStatusStrip
        apiStatus={data.health.apiStatus}
        queueStatus={data.health.queueStatus}
        workerStatus={data.health.workerStatus}
        queueCounts={data.health.queueCounts}
        workerAgeMs={data.health.workerAgeMs}
        lastSuccessfulDeployAt={data.health.lastSuccessfulDeployAt}
      />

      {deploymentHistoryUnavailable ? (
        <DemoModeBanner detail={data.liveDataErrorMessage}>
          Platform health is live, but deployment history metrics are unavailable.
        </DemoModeBanner>
      ) : null}

      {deploymentHistoryPartial ? (
        <DemoModeBanner title="Partial outage" detail={data.liveDataErrorMessage}>
          Platform health is live, but some deployment history metrics may be incomplete.
        </DemoModeBanner>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Deployment Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentHistoryUnavailable ? (
              <>
                <p className="text-2xl font-semibold">Unavailable</p>
                <p className="text-xs text-muted-foreground">
                  Deployment history metrics require live project/deployment access.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold">{successRate === null ? 'N/A' : `${successRate}%`}</p>
                <p className="text-xs text-muted-foreground">
                  Based on {terminalOutcomes.length} terminal deployments in the latest {recent.length} records. Stopped deployments count as non-successful outcomes.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Queue Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>waiting: <span className="font-medium">{data.health.queueCounts.waiting}</span></p>
            <p>active: <span className="font-medium">{data.health.queueCounts.active}</span></p>
            <p>completed: <span className="font-medium">{data.health.queueCounts.completed}</span></p>
            <p>failed: <span className="font-medium">{data.health.queueCounts.failed}</span></p>
            <StatusQueueTrend />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker Heartbeat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {typeof data.health.workerAgeMs === 'number'
                ? `${Math.round(data.health.workerAgeMs / 1000)}s ago`
                : 'No heartbeat telemetry'}
            </p>
            <p className="text-xs text-muted-foreground">Lower is healthier. Stale signals indicate delayed processing.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Deployment Outcomes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deploymentHistoryUnavailable ? (
            <>
              <p className="text-sm text-muted-foreground">
                Recent deployment outcomes are unavailable.
              </p>
              <p className="text-xs text-muted-foreground">{data.liveDataErrorMessage}</p>
            </>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment history available yet.</p>
          ) : terminalOutcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed deployment outcomes yet in the latest activity. Recent deployments are still queued or building.
            </p>
          ) : (
            terminalOutcomes.map(({ deployment, project }) => (
              <div key={deployment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{truncateUuid(deployment.id)}</p>
                </div>
                <DeploymentStatusBadges
                  status={deployment.status}
                  cancellationRequested={hasRequestedCancellation(deployment.metadata)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
