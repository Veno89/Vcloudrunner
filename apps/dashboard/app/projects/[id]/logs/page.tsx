import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LogsAutoRefresh } from '@/components/logs-auto-refresh';
import { LogsLiveStream } from '@/components/logs-live-stream';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import {
  apiAuthToken,
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchDeploymentLogs,
} from '@/lib/api';
import { describeDashboardLiveDataFailure, formatRelativeTime, truncateUuid } from '@/lib/helpers';

interface ProjectLogsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    logsDeploymentId?: string;
    logsAutoRefresh?: '0' | '1';
    logsPage?: string;
  };
}

export default async function ProjectLogsPage({ params, searchParams }: ProjectLogsPageProps) {
  if (!demoUserId) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          description={describeDashboardLiveDataFailure({
            hasDemoUserId: false,
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForDemoUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    const deployments = await fetchDeploymentsForProject(project.id);
    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const selectedDeployment =
      sortedDeployments.find((item) => item.id === searchParams?.logsDeploymentId) ??
      sortedDeployments[0];

    const logsPageSize = 100;
    const currentLogsPage = Math.max(1, Number.parseInt(searchParams?.logsPage ?? '1', 10) || 1);

    const allDeploymentLogs = selectedDeployment
      ? await fetchDeploymentLogs(project.id, selectedDeployment.id, 500)
      : [];
    const totalLogPages = Math.max(1, Math.ceil(allDeploymentLogs.length / logsPageSize));
    const safeLogsPage = Math.min(currentLogsPage, totalLogPages);
    const pageStart = (safeLogsPage - 1) * logsPageSize;
    const deploymentLogs = allDeploymentLogs.slice(pageStart, pageStart + logsPageSize);

    const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';
    const refreshedAt = new Date().toISOString();

    const buildProjectLogsHref = (page: number) => {
      const params = new URLSearchParams();
      if (selectedDeployment) {
        params.set('logsDeploymentId', selectedDeployment.id);
      }
      if (logsAutoRefreshEnabled) {
        params.set('logsAutoRefresh', '1');
      }
      params.set('logsPage', String(page));
      return `/projects/${project.id}/logs?${params.toString()}`;
    };

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Logs</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and export logs for deployments in <span className="font-medium text-foreground">{project.name}</span>.
          </p>
        </div>

        <ProjectSubnav projectId={project.id} />

        {selectedDeployment ? (
          <>
            <LogsAutoRefresh enabled={logsAutoRefreshEnabled} />
            <LastRefreshedIndicator refreshedAt={refreshedAt} staleAfterSeconds={15} />

            <form className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <Label htmlFor="project-logs-deployment-id" className="sr-only">Deployment selection</Label>
              <Select
                id="project-logs-deployment-id"
                name="logsDeploymentId"
                defaultValue={selectedDeployment.id}
              >
                {sortedDeployments.map((deployment) => (
                  <option key={deployment.id} value={deployment.id}>
                    {truncateUuid(deployment.id)} • {formatRelativeTime(deployment.createdAt)} • {deployment.status}
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
                Showing logs for deployment: <span className="font-medium text-foreground">{truncateUuid(selectedDeployment.id)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/deployments/${selectedDeployment.id}`}>Deployment</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/log-export?projectId=${encodeURIComponent(project.id)}&deploymentId=${encodeURIComponent(selectedDeployment.id)}`}>
                    Export NDJSON
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/log-export?projectId=${encodeURIComponent(project.id)}&deploymentId=${encodeURIComponent(selectedDeployment.id)}&format=ndjson.gz`}>
                    Export GZIP
                  </a>
                </Button>
              </div>
            </div>

            <LogsLiveStream
              projectId={project.id}
              deploymentId={selectedDeployment.id}
              initialLogs={deploymentLogs}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
              <span>Log page {safeLogsPage} of {totalLogPages}</span>
              <div className="flex items-center gap-2">
                {safeLogsPage <= 1 ? (
                  <Button variant="outline" size="sm" disabled>Previous logs</Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildProjectLogsHref(safeLogsPage - 1)}>Previous logs</Link>
                  </Button>
                )}
                {safeLogsPage >= totalLogPages ? (
                  <Button variant="outline" size="sm" disabled>Next logs</Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildProjectLogsHref(safeLogsPage + 1)}>Next logs</Link>
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {logsAutoRefreshEnabled
                ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
                : 'Auto-refresh is disabled. Click Apply to refresh or enable auto-refresh.'}
            </p>
          </>
        ) : (
          <EmptyState
            title="No deployments yet"
            description="Trigger a deployment for this project to start collecting logs."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${project.id}`}>Open Project</Link>
              </Button>
            }
          />
        )}
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          title="Project logs unavailable"
          description={describeDashboardLiveDataFailure({
            error,
            hasDemoUserId: true,
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
        />
      </PageLayout>
    );
  }
}
