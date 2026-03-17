import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { ProjectSubnav } from '@/components/project-subnav';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ActionToast } from '@/components/action-toast';
import { PageLayout } from '@/components/page-layout';
import {
  apiAuthToken,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchEnvironmentVariables,
  fetchDeploymentLogs,
  demoUserId,
} from '@/lib/api';
import { describeDashboardLiveDataFailure, formatRelativeTime, logLevelTextClassName, truncateUuid } from '@/lib/helpers';
import { deployProjectAction } from '@/app/deployments/actions';

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

function deploymentStatusVariant(status: DeploymentStatus) {
  if (status === 'running') return 'success' as const;
  if (status === 'queued' || status === 'building') return 'warning' as const;
  if (status === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}


export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
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

    const [deployments, environmentVariables] = await Promise.all([
      fetchDeploymentsForProject(project.id),
      fetchEnvironmentVariables(project.id),
    ]);

    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const latestDeployment = sortedDeployments[0] ?? null;
    const latestLogs =
      latestDeployment
        ? await fetchDeploymentLogs(project.id, latestDeployment.id, 20)
        : [];

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.gitRepositoryUrl}</p>
            <p className="text-sm text-primary">{project.slug}.apps.platform.example.com</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
        <ProjectSubnav projectId={project.id} />

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Deployment action failed."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deployments</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{sortedDeployments.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Environment Variables</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{environmentVariables.length}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Latest Status</CardTitle>
            </CardHeader>
            <CardContent>
              {latestDeployment ? (
                <Badge variant={deploymentStatusVariant(latestDeployment.status)}>
                  {latestDeployment.status}
                </Badge>
              ) : (
                <p className="text-muted-foreground">No deployments</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action={deployProjectAction}>
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <input type="hidden" name="projectName" value={project.name} readOnly />
              <input type="hidden" name="returnPath" value={`/projects/${project.id}`} readOnly />
              <FormSubmitButton
                idleText="Deploy"
                pendingText="Deploying..."
                variant="default"
                size="sm"
              />
            </form>
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/environment`}>Open Environment</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={latestDeployment ? `/projects/${project.id}/logs?logsDeploymentId=${latestDeployment.id}` : `/projects/${project.id}/logs`}>
                Open Logs
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/deployments`}>Open Deployments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedDeployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deployments yet for this project.</p>
            ) : (
              <div className="space-y-2">
                {sortedDeployments.slice(0, 10).map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-xs">{truncateUuid(deployment.id)}</p>
                      <p className="text-xs text-muted-foreground" title={new Date(deployment.createdAt).toLocaleString()}>
                        {formatRelativeTime(deployment.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={deploymentStatusVariant(deployment.status)}>{deployment.status}</Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/deployments/${deployment.id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latest Deployment Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {latestDeployment ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deployment {truncateUuid(latestDeployment.id)}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/projects/${project.id}/logs?logsDeploymentId=${latestDeployment.id}`}>Open full logs</Link>
                  </Button>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border bg-background p-2 font-mono text-xs">
                  {latestLogs.length === 0 ? (
                    <p className="text-muted-foreground">No logs captured yet.</p>
                  ) : (
                    latestLogs.map((log, index) => (
                      <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words">
                        <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                        <span className={logLevelTextClassName(log.level)}>{log.level.toUpperCase()}</span> {log.message}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Trigger a deployment to see logs.</p>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          title="Project data unavailable"
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
