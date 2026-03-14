import { DeploymentTable } from '@/components/deployment-table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadDashboardData } from '@/lib/loaders';
import { deployments as mockDeployments } from '@/lib/mock-data';
import { truncateUuid } from '@/lib/helpers';
import Link from 'next/link';

export default async function DeploymentsPage() {
  const data = await loadDashboardData();
  const deployments = data.usingLiveData ? data.deployments : mockDeployments;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
        <p className="text-sm text-muted-foreground">
          Recent deployments across all projects.
        </p>
      </div>

      {!data.usingLiveData && (
        <div className="rounded-md border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Demo mode: API data unavailable, showing sample deployment data.
        </div>
      )}

      {deployments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No deployments yet. Trigger a deployment from the Projects page.
          </CardContent>
        </Card>
      ) : (
        <>
          <DeploymentTable deployments={deployments} />

          {data.usingLiveData && data.sortedDeployments.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Quick Links</h2>
              <div className="flex flex-wrap gap-2">
                {data.sortedDeployments.slice(0, 10).map(({ deployment, project }) => (
                  <Link
                    key={deployment.id}
                    href={`/deployments/${deployment.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    <span className="text-muted-foreground">{project.name}</span>
                    <span className="font-mono">{truncateUuid(deployment.id)}</span>
                    <DeploymentStatusBadge status={deployment.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DeploymentStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'running'
      ? 'success'
      : status === 'building' || status === 'queued'
        ? 'warning'
        : status === 'failed'
          ? 'destructive'
          : 'secondary';

  return <Badge variant={variant}>{status}</Badge>;
}
