import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { ProjectSubnav } from '@/components/project-subnav';
import { PageLayout } from '@/components/page-layout';
import { EmptyState } from '@/components/empty-state';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ActionToast } from '@/components/action-toast';
import {
  apiAuthToken,
  fetchProjectsForCurrentUser,
  resolveViewerContext,
  fetchDeploymentsForProject,
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  describeDashboardLiveDataFailure,
  formatRelativeTime,
  hasRequestedCancellation,
  truncateUuid
} from '@/lib/helpers';
import { deployProjectAction } from '@/app/deployments/actions';

interface ProjectDeploymentsPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}
export default async function ProjectDeploymentsPage({ params, searchParams }: ProjectDeploymentsPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}/deployments`}
        />
      </PageLayout>
    );
  }

  try {
    const projects = await fetchProjectsForCurrentUser();
    const project = projects.find((item) => item.id === params.id);

    if (!project) {
      notFound();
    }

    let deployments: Awaited<ReturnType<typeof fetchDeploymentsForProject>> = [];
    let deploymentReadErrorMessage: string | null = null;

    try {
      deployments = await fetchDeploymentsForProject(project.id);
    } catch (error) {
      deploymentReadErrorMessage = describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: Boolean(viewer.userId),
        hasApiAuthToken: Boolean(apiAuthToken)
      });
    }

    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return (
      <PageLayout>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${project.id}`} className="hover:text-foreground">{project.name}</Link>
          <span>/</span>
          <span className="text-foreground">Deployments</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Deployments</h1>
          <p className="text-sm text-muted-foreground">
            Deployment history for <span className="font-medium text-foreground">{project.name}</span>.
          </p>
        </div>

        <ProjectSubnav projectId={project.id} />

        {deploymentReadErrorMessage ? (
          <DemoModeBanner title="Partial outage" detail={deploymentReadErrorMessage}>
            Deployment history is temporarily unavailable, but project actions are still available.
          </DemoModeBanner>
        ) : null}

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Deployment action failed."
        />

        <div className="flex flex-wrap gap-2">
          <form action={deployProjectAction}>
            <input type="hidden" name="projectId" value={project.id} readOnly />
            <input type="hidden" name="projectName" value={project.name} readOnly />
            <input type="hidden" name="returnPath" value={`/projects/${project.id}/deployments`} readOnly />
            <FormSubmitButton
              idleText="Deploy"
              pendingText="Deploying..."
              variant="default"
              size="sm"
            />
          </form>
        </div>

        {deploymentReadErrorMessage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Project deployments unavailable</p>
                <p className="mt-1 text-xs">{deploymentReadErrorMessage}</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedDeployments.length === 0 ? (
          <EmptyState
            title="No deployments yet"
            description="Trigger a deployment to create the first deployment record for this project."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedDeployments.map((deployment) => (
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
                      <DeploymentStatusBadges
                        status={deployment.status}
                        cancellationRequested={hasRequestedCancellation(deployment.metadata)}
                      />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/deployments/${deployment.id}`}>View</Link>
                      </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </PageLayout>
    );
  } catch (error) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          title="Project deployments unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}/deployments`}
        />
      </PageLayout>
    );
  }
}
