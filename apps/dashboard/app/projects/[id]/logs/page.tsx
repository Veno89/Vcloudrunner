import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogsAutoRefresh } from '@/components/logs-auto-refresh';
import { LogsLiveStream } from '@/components/logs-live-stream';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import { ProjectSubnav } from '@/components/project-subnav';
import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchDeploymentLogs,
} from '@/lib/api';

interface ProjectLogsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    logsDeploymentId?: string;
    logsAutoRefresh?: '0' | '1';
  };
}

export default async function ProjectLogsPage({ params, searchParams }: ProjectLogsPageProps) {
  if (!demoUserId) {
    notFound();
  }

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

  const deploymentLogs = selectedDeployment
    ? await fetchDeploymentLogs(project.id, selectedDeployment.id, 100)
    : [];

  const logsAutoRefreshEnabled = searchParams?.logsAutoRefresh === '1';
  const refreshedAt = new Date().toISOString();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
            <select
              id="project-logs-deployment-id"
              name="logsDeploymentId"
              defaultValue={selectedDeployment.id}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {sortedDeployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.id} ({deployment.status})
                </option>
              ))}
            </select>
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
              Showing logs for deployment: <span className="font-medium text-foreground">{selectedDeployment.id}</span>
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

          <p className="text-xs text-muted-foreground">
            {logsAutoRefreshEnabled
              ? 'Auto-refresh is enabled. Log entries refresh every 5 seconds.'
              : 'Auto-refresh is disabled. Click Apply to refresh or enable auto-refresh.'}
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No deployments found for this project.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
