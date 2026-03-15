import { PageLayout } from '@/components/page-layout';
import { PageHeader } from '@/components/page-header';
import { PlatformStatusStrip } from '@/components/platform-status-strip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadDashboardData } from '@/lib/loaders';
import { truncateUuid } from '@/lib/helpers';
import { StatusQueueTrend } from '@/components/status-queue-trend';

function deploymentStatusVariant(status: string) {
  if (status === 'running') return 'success' as const;
  if (status === 'building' || status === 'queued') return 'warning' as const;
  if (status === 'failed' || status === 'cancelled') return 'destructive' as const;
  return 'secondary' as const;
}

export default async function StatusPage() {
  const data = await loadDashboardData();
  const recent = data.sortedDeployments.slice(0, 20);
  const completed = recent.filter((item) => item.deployment.status === 'running' || item.deployment.status === 'failed');
  const successful = completed.filter((item) => item.deployment.status === 'running').length;
  const successRate = completed.length > 0 ? Math.round((successful / completed.length) * 100) : null;

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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Deployment Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{successRate === null ? 'N/A' : `${successRate}%`}</p>
            <p className="text-xs text-muted-foreground">
              Based on {completed.length} completed deployments in the latest {recent.length} records.
            </p>
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
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment history available yet.</p>
          ) : (
            recent.map(({ deployment, project }) => (
              <div key={deployment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{truncateUuid(deployment.id)}</p>
                </div>
                <Badge variant={deploymentStatusVariant(deployment.status)}>{deployment.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
