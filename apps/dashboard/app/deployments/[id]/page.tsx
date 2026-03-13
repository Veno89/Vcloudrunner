import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadDashboardData } from '@/lib/loaders';
import { fetchDeploymentLogs } from '@/lib/api';
import { truncateUuid } from '@/lib/helpers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface DeploymentDetailPageProps {
  params: { id: string };
}

export default async function DeploymentDetailPage({ params }: DeploymentDetailPageProps) {
  const data = await loadDashboardData();

  if (!data.usingLiveData) {
    redirect('/deployments');
  }

  const match = data.sortedDeployments.find(
    (item) => item.deployment.id === params.id
  );

  if (!match) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployment Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The requested deployment does not exist or is no longer available.
          </p>
        </div>
        <Link href="/deployments" className="text-sm text-primary hover:underline">
          &larr; Back to Deployments
        </Link>
      </div>
    );
  }

  const { deployment, project } = match;

  const logs = await fetchDeploymentLogs(project.id, deployment.id, 50);

  const statusVariant =
    deployment.status === 'running'
      ? 'success'
      : deployment.status === 'building' || deployment.status === 'queued'
        ? 'warning'
        : deployment.status === 'failed'
          ? 'destructive'
          : 'secondary';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/deployments" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Deployments
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold tracking-tight">
          {project.name} / <span className="font-mono">{truncateUuid(deployment.id)}</span>
        </h1>
        <Badge variant={statusVariant}>{deployment.status}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Deployment ID" value={deployment.id} mono />
            <DetailRow label="Project" value={project.name} />
            <DetailRow label="Status" value={deployment.status} />
            <DetailRow label="Commit" value={deployment.commitSha ?? 'unknown'} mono />
            <DetailRow
              label="Runtime URL"
              value={deployment.runtimeUrl ?? 'pending'}
              className="text-primary break-all"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs">
                <TimelineEntry label="Created" timestamp={deployment.createdAt} />
                <TimelineEntry
                  label="Started"
                  timestamp={deployment.startedAt ?? undefined}
                  fallback="not started"
                />
                <TimelineEntry
                  label="Finished"
                  timestamp={deployment.finishedAt ?? undefined}
                  fallback="in progress"
                />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 overflow-auto rounded-md border bg-background p-2 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs captured for this deployment yet.</p>
                ) : (
                  logs.map((log, index) => (
                    <p
                      key={`${log.timestamp}-${index}`}
                      className="mb-1 whitespace-pre-wrap break-words"
                    >
                      <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                      <span className="text-primary">{log.level.toUpperCase()}</span> {log.message}
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`${mono ? 'font-mono text-xs' : ''} ${className ?? ''}`}>{value}</p>
    </div>
  );
}

function TimelineEntry({
  label,
  timestamp,
  fallback,
}: {
  label: string;
  timestamp?: string;
  fallback?: string;
}) {
  return (
    <li className="rounded-md border bg-background px-2.5 py-2">
      <span className="text-primary">{label}:</span>{' '}
      {timestamp ? new Date(timestamp).toLocaleString() : fallback ?? 'N/A'}
    </li>
  );
}
