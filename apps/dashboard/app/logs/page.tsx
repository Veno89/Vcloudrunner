import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LogsAutoRefresh } from '@/components/logs-auto-refresh';
import { LogsLiveStream } from '@/components/logs-live-stream';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import Link from 'next/link';
import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchDeploymentLogs,
} from '@/lib/api';
import { formatRelativeTime, truncateUuid } from '@/lib/helpers';

interface LogsPageProps {
  searchParams?: {
    logsDeploymentId?: string;
    logsAutoRefresh?: '0' | '1';
  };
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  let deploymentOptions: Array<{
    id: string;
    projectId: string;
    projectName: string;
    status: string;
    label: string;
  }> = [];
  let deploymentLogs: Array<{ level: string; message: string; timestamp: string }> = [];
  let selectedProjectId = '';
  let selectedDeploymentId = '';
  let selectedLabel = '';

  const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';
  const refreshedAt = new Date().toISOString();

  if (demoUserId) {
    try {
      const apiProjects = await fetchProjectsForDemoUser();
      const groups = await Promise.all(
        apiProjects.map(async (project) => {
          const items = await fetchDeploymentsForProject(project.id);
          return items.map((d) => ({ deployment: d, project }));
        })
      );

      const sorted = groups
        .flat()
        .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt));

      deploymentOptions = sorted.slice(0, 25).map(({ deployment, project }) => ({
        id: deployment.id,
        projectId: project.id,
        projectName: project.name,
        status: deployment.status,
        label: `${project.name} • ${truncateUuid(deployment.id)} • ${formatRelativeTime(deployment.createdAt)} • ${deployment.status}`,
      }));

      const selected =
        sorted.find((item) => item.deployment.id === searchParams?.logsDeploymentId) ??
        sorted[0];

      if (selected) {
        selectedProjectId = selected.project.id;
        selectedDeploymentId = selected.deployment.id;
        selectedLabel = `${selected.project.name} / ${truncateUuid(selected.deployment.id)}`;
        const logs = await fetchDeploymentLogs(
          selected.project.id,
          selected.deployment.id,
          100
        );
        deploymentLogs = logs.map((item) => ({
          level: item.level,
          message: item.message,
          timestamp: item.timestamp,
        }));
      }
    } catch {
      // will show empty state
    }
  }

  const hasLiveData = Boolean(demoUserId && selectedDeploymentId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deployment Logs</h1>
        <p className="text-sm text-muted-foreground">
          Global shortcut for log access. Prefer project-scoped logs while investigating a single project.
        </p>
      </div>

      {hasLiveData ? (
        <>
          <LogsAutoRefresh enabled={logsAutoRefreshEnabled} />
          <LastRefreshedIndicator refreshedAt={refreshedAt} staleAfterSeconds={15} />

          <form className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Label htmlFor="logs-deployment-id" className="sr-only">Deployment selection</Label>
            <Select
              id="logs-deployment-id"
              name="logsDeploymentId"
              defaultValue={searchParams?.logsDeploymentId ?? deploymentOptions[0]?.id}
            >
              {deploymentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs">
              <input
                type="checkbox"
                name="logsAutoRefresh"
                value="1"
                defaultChecked={logsAutoRefreshEnabled}
              />
              Auto-refresh (5s)
            </label>
            <Button type="submit">Apply</Button>
          </form>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Showing logs for: <span className="font-medium text-foreground">{selectedLabel}</span>
            </p>
            {selectedProjectId && selectedDeploymentId && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/projects/${selectedProjectId}/logs?logsDeploymentId=${selectedDeploymentId}`}>Project Logs</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/projects/${selectedProjectId}`}>Project</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/deployments/${selectedDeploymentId}`}>Deployment</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={`/api/log-export?projectId=${encodeURIComponent(selectedProjectId)}&deploymentId=${encodeURIComponent(selectedDeploymentId)}`}>
                    Export NDJSON
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                >
                  <a href={`/api/log-export?projectId=${encodeURIComponent(selectedProjectId)}&deploymentId=${encodeURIComponent(selectedDeploymentId)}&format=ndjson.gz`}>
                    Export GZIP
                  </a>
                </Button>
              </div>
            )}
          </div>

          {selectedProjectId && selectedDeploymentId && (
            <LogsLiveStream
              projectId={selectedProjectId}
              deploymentId={selectedDeploymentId}
              initialLogs={deploymentLogs}
            />
          )}

          <p className="text-xs text-muted-foreground">
            {logsAutoRefreshEnabled
              ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
              : 'Auto-refresh is disabled. Click Apply to refresh or enable auto-refresh.'}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {demoUserId
              ? 'No deployments found. Trigger a deployment first.'
              : 'Log viewer requires a demo user context. Set NEXT_PUBLIC_DEMO_USER_ID.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
