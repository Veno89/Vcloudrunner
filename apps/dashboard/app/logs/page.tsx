import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LogsAutoRefresh } from '@/components/logs-auto-refresh';
import { LogsLiveStream } from '@/components/logs-live-stream';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import Link from 'next/link';
import {
  apiAuthToken,
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchDeploymentLogs,
} from '@/lib/api';
import { describeDashboardLiveDataFailure, formatRelativeTime, truncateUuid } from '@/lib/helpers';

interface LogsPageProps {
  searchParams?: {
    logsDeploymentId?: string;
    logsAutoRefresh?: '0' | '1';
    logsPage?: string;
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
  let totalLogPages = 1;
  let liveDataErrorMessage: string | null = null;
  let logReadErrorMessage: string | null = null;
  const logsPageSize = 100;

  const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';
  const currentLogsPage = Math.max(1, Number.parseInt(searchParams?.logsPage ?? '1', 10) || 1);
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
        try {
          const logs = await fetchDeploymentLogs(
            selected.project.id,
            selected.deployment.id,
            500
          );
          const mappedLogs = logs.map((item) => ({
            level: item.level,
            message: item.message,
            timestamp: item.timestamp,
          }));
          totalLogPages = Math.max(1, Math.ceil(mappedLogs.length / logsPageSize));
          const safeLogsPage = Math.min(currentLogsPage, totalLogPages);
          const pageStart = (safeLogsPage - 1) * logsPageSize;
          deploymentLogs = mappedLogs.slice(pageStart, pageStart + logsPageSize);
        } catch (error) {
          logReadErrorMessage = describeDashboardLiveDataFailure({
            error,
            hasDemoUserId: true,
            hasApiAuthToken: Boolean(apiAuthToken)
          });
        }
      }
    } catch (error) {
      liveDataErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: true,
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }
  } else {
    liveDataErrorMessage = describeDashboardLiveDataFailure({
      hasDemoUserId: false,
      hasApiAuthToken: Boolean(apiAuthToken)
    });
  }

  const hasLiveData = Boolean(selectedDeploymentId);

  const buildLogsHref = (page: number) => {
    const params = new URLSearchParams();
    if (selectedDeploymentId) {
      params.set('logsDeploymentId', selectedDeploymentId);
    }
    if (logsAutoRefreshEnabled) {
      params.set('logsAutoRefresh', '1');
    }
    params.set('logsPage', String(page));
    return `/logs?${params.toString()}`;
  };

  return (
    <PageLayout>
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
            <input type="hidden" name="logsPage" value="1" />
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

          {logReadErrorMessage ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
              <p className="font-medium text-destructive">Historical logs unavailable</p>
              <p className="mt-1 text-xs">{logReadErrorMessage}</p>
            </div>
          ) : null}

          {selectedProjectId && selectedDeploymentId && !logReadErrorMessage ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
              <span>Log page {Math.min(currentLogsPage, totalLogPages)} of {totalLogPages}</span>
              <div className="flex items-center gap-2">
                {currentLogsPage <= 1 ? (
                  <Button variant="outline" size="sm" disabled>Previous logs</Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildLogsHref(currentLogsPage - 1)}>Previous logs</Link>
                  </Button>
                )}
                {currentLogsPage >= totalLogPages ? (
                  <Button variant="outline" size="sm" disabled>Next logs</Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildLogsHref(currentLogsPage + 1)}>Next logs</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {logsAutoRefreshEnabled
              ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
              : 'Auto-refresh is disabled. Click Apply to refresh or enable auto-refresh.'}
          </p>
        </>
      ) : liveDataErrorMessage ? (
        <LiveDataUnavailableState
          title="Global log viewer unavailable"
          description={liveDataErrorMessage}
          actionHref="/projects"
          actionLabel="Open Projects"
        />
      ) : (
        <EmptyState
          title="No deployments yet"
          description="Trigger a deployment from the Projects page, then return here to inspect live logs."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">Open Projects</Link>
            </Button>
          }
        />
      )}
    </PageLayout>
  );
}
