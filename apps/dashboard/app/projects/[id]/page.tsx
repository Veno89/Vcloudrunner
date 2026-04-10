import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildProjectServiceInternalHostname,
  getPrimaryProjectService
} from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { ProjectSubnav } from '@/components/project-subnav';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ActionToast } from '@/components/action-toast';
import { PageLayout } from '@/components/page-layout';
import { ProjectTourClient } from '@/components/onboarding/project-tour-client';
import {
  apiAuthToken,
  fetchProjectDatabases,
  fetchProjectDomains,
  fetchProjectsForCurrentUser,
  fetchDeploymentsForProject,
  fetchEnvironmentVariables,
  fetchDeploymentLogs,
  resolveViewerContext,
} from '@/lib/api';
import { getDashboardRequestAuth } from '@/lib/dashboard-session';
import {
  describeDashboardLiveDataFailure,
  formatRelativeTime,
  hasRequestedCancellation,
  logLevelTextClassName,
  truncateUuid
} from '@/lib/helpers';
import {
  composeProjectStatus,
  createProjectServiceStatuses,
  formatProjectServiceStatusBreakdown
} from '@/lib/project-service-status';
import { summarizeProjectDomains } from '@/lib/project-domains';
import { summarizeProjectDatabases } from '@/lib/project-databases';
import { deployProjectAction, deployAllServicesAction } from '@/app/deployments/actions';
import {
  deleteProjectAction,
} from '@/app/projects/actions';

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}


export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const requestAuth = getDashboardRequestAuth();
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <DashboardUnavailableState
          requestAuth={requestAuth}
          {...(viewerContextError ? { error: viewerContextError } : {})}
          redirectTo={`/projects/${params.id}`}
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

    const [deploymentsResult, environmentVariablesResult, projectDomainsResult, projectDatabasesResult] = await Promise.allSettled([
      fetchDeploymentsForProject(project.id),
      fetchEnvironmentVariables(project.id),
      fetchProjectDomains(project.id),
      fetchProjectDatabases(project.id),
    ]);
    const deployments =
      deploymentsResult.status === 'fulfilled' ? deploymentsResult.value : [];
    const environmentVariables =
      environmentVariablesResult.status === 'fulfilled' ? environmentVariablesResult.value : [];
    const projectDomains =
      projectDomainsResult.status === 'fulfilled' ? projectDomainsResult.value : [];
    const projectDatabases =
      projectDatabasesResult.status === 'fulfilled' ? projectDatabasesResult.value : [];
    const deploymentReadErrorMessage =
      deploymentsResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: deploymentsResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;
    const environmentReadErrorMessage =
      environmentVariablesResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: environmentVariablesResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;

    const projectDomainsReadErrorMessage =
      projectDomainsResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: projectDomainsResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;
    const projectDatabasesReadErrorMessage =
      projectDatabasesResult.status === 'rejected'
        ? describeDashboardLiveDataFailure({
            error: projectDatabasesResult.reason,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })
        : null;
    const partialOutageDetail = [
      deploymentReadErrorMessage ? `Deployment history unavailable. ${deploymentReadErrorMessage}` : null,
      environmentReadErrorMessage ? `Environment variables unavailable. ${environmentReadErrorMessage}` : null,
      projectDomainsReadErrorMessage ? `Project domains unavailable. ${projectDomainsReadErrorMessage}` : null,
      projectDatabasesReadErrorMessage ? `Managed databases unavailable. ${projectDatabasesReadErrorMessage}` : null
    ]
      .filter((message): message is string => Boolean(message))
      .join(' ');

    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const activeDeletionBlockedDeployments = sortedDeployments.filter((deployment) =>
      deployment.status === 'queued'
      || deployment.status === 'building'
      || deployment.status === 'running'
    );
    const activeDeletionBlockedDeploymentSummary = activeDeletionBlockedDeployments
      .map((deployment) => `${deployment.serviceName ?? 'app'} (${deployment.status})`)
      .join(', ');
    const primaryService = getPrimaryProjectService(project.services);
    const routeSummary = summarizeProjectDomains({
      project,
      domains: projectDomains,
      domainsUnavailable: Boolean(projectDomainsReadErrorMessage)
    });
    const databaseSummary = summarizeProjectDatabases({
      databases: projectDatabases,
      databasesUnavailable: Boolean(projectDatabasesReadErrorMessage)
    });
    const serviceStatuses = createProjectServiceStatuses(project.services, sortedDeployments);
    const serviceStatusesByName = new Map(
      serviceStatuses.map((serviceStatus) => [serviceStatus.service.name, serviceStatus])
    );
    const composedProjectStatus = composeProjectStatus(serviceStatuses);
    const composedServiceStatusBreakdown = formatProjectServiceStatusBreakdown(serviceStatuses);
    const canDeleteProject =
      Boolean(viewer.user)
      && (
        viewer.role === 'admin'
        || project.userId === viewer.userId
      );

    const latestDeployment = sortedDeployments[0] ?? null;
    let latestLogs: Array<{ level: string; message: string; timestamp: string }> = [];
    let latestLogsErrorMessage: string | null = null;

    if (latestDeployment) {
      try {
        latestLogs = await fetchDeploymentLogs(project.id, latestDeployment.id, 20);
      } catch (error) {
        latestLogsErrorMessage = describeDashboardLiveDataFailure({
          error,
          hasDemoUserId: Boolean(viewer.userId),
          hasApiAuthToken: Boolean(apiAuthToken)
        });
      }
    }

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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-primary">{routeSummary.host}</p>
              <Badge variant={routeSummary.variant}>{routeSummary.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {project.services.length} service{project.services.length === 1 ? '' : 's'} configured.
              Primary public service: <span className="font-medium text-foreground">{primaryService.name}</span>
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
        <ProjectSubnav projectId={project.id} />
        <ProjectTourClient />

        {partialOutageDetail ? (
          <DemoModeBanner title="Partial outage" detail={partialOutageDetail}>
            Some project detail panels are temporarily unavailable, but the project page is still live.
          </DemoModeBanner>
        ) : null}

        <ActionToast
          status={searchParams?.status}
          message={searchParams?.message}
          fallbackErrorMessage="Project action failed."
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              {deploymentReadErrorMessage ? (
                <>
                  <p className="text-2xl font-semibold">Unavailable</p>
                  <p className="text-xs text-muted-foreground">Deployment history could not be loaded.</p>
                </>
              ) : (
                <p className="text-2xl font-semibold">{sortedDeployments.length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Environment Variables</CardTitle>
            </CardHeader>
            <CardContent>
              {environmentReadErrorMessage ? (
                <>
                  <p className="text-2xl font-semibold">Unavailable</p>
                  <p className="text-xs text-muted-foreground">Environment variables could not be loaded.</p>
                </>
              ) : (
                <p className="text-2xl font-semibold">{environmentVariables.length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Service Status</CardTitle>
            </CardHeader>
            <CardContent>
              {deploymentReadErrorMessage ? (
                <p className="text-muted-foreground">Unavailable</p>
              ) : (
                <div className="space-y-2">
                  <Badge variant={composedProjectStatus.variant}>{composedProjectStatus.label}</Badge>
                  <p className="text-xs text-muted-foreground">{composedServiceStatusBreakdown}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Databases</CardTitle>
            </CardHeader>
            <CardContent>
              {projectDatabasesReadErrorMessage ? (
                <>
                  <p className="text-2xl font-semibold">Unavailable</p>
                  <p className="text-xs text-muted-foreground">Managed databases could not be loaded.</p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-2xl font-semibold">{projectDatabases.length}</p>
                  <Badge variant={databaseSummary.variant}>{databaseSummary.label}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Services</CardTitle>
            {project.services.length > 1 && (
              <form action={deployAllServicesAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}`} />
                <FormSubmitButton
                  idleText="Deploy All"
                  pendingText="Deploying..."
                  variant="outline"
                  size="sm"
                />
              </form>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Project environment variables remain shared at the project level. Deployments now also receive generated `VCLOUDRUNNER_SERVICE_*` discovery variables plus a stable internal host per service on the worker network.
            </p>
            <div className="space-y-2">
              {project.services.map((service) => {
                const serviceStatus = serviceStatusesByName.get(service.name) ?? null;
                const runtimeDetails = [
                  typeof service.runtime?.containerPort === 'number'
                    ? `port ${service.runtime.containerPort}`
                    : null,
                  typeof service.runtime?.memoryMb === 'number'
                    ? `${service.runtime.memoryMb}MB`
                    : null,
                  typeof service.runtime?.cpuMillicores === 'number'
                    ? `${service.runtime.cpuMillicores}m CPU`
                    : null
                ].filter((value): value is string => Boolean(value));

                return (
                  <div
                    key={service.name}
                    className="rounded-md border px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{service.name}</p>
                        <Badge variant={service.exposure === 'public' ? 'default' : 'secondary'}>
                          {service.exposure}
                        </Badge>
                        <Badge variant="outline">{service.kind}</Badge>
                        {service.name === primaryService.name ? (
                          <Badge variant="secondary">primary</Badge>
                        ) : null}
                        {deploymentReadErrorMessage ? (
                          <Badge variant="warning">history unavailable</Badge>
                        ) : serviceStatus?.deploymentStatus ? (
                          <DeploymentStatusBadges
                            status={serviceStatus.deploymentStatus}
                            cancellationRequested={serviceStatus.cancellationRequested}
                          />
                        ) : (
                          <Badge variant="secondary">no deployments</Badge>
                        )}
                      </div>
                      <form action={deployProjectAction}>
                        <input type="hidden" name="projectId" value={project.id} readOnly />
                        <input type="hidden" name="projectName" value={project.name} readOnly />
                        <input type="hidden" name="serviceName" value={service.name} readOnly />
                        <input type="hidden" name="returnPath" value={`/projects/${project.id}`} readOnly />
                        <FormSubmitButton
                          idleText={`Deploy ${service.name}`}
                          pendingText="Deploying..."
                          variant={service.name === primaryService.name ? 'default' : 'outline'}
                          size="sm"
                        />
                      </form>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source root: <span className="font-mono text-foreground">{service.sourceRoot}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Internal host: <span className="font-mono text-foreground">{buildProjectServiceInternalHostname(project.slug, service.name)}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deployment status:{' '}
                      {deploymentReadErrorMessage
                        ? 'history unavailable'
                        : serviceStatus
                          ? serviceStatus.statusText
                          : 'no deployments'}
                      {serviceStatus?.latestDeployment
                        ? ` | latest ${formatRelativeTime(serviceStatus.latestDeployment.createdAt)}`
                        : ''}
                    </p>
                    {serviceStatus?.latestDeployment?.runtimeUrl ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Public URL:{' '}
                        <a
                          href={serviceStatus.latestDeployment.runtimeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {serviceStatus.latestDeployment.runtimeUrl}
                        </a>
                      </p>
                    ) : null}
                    {serviceStatus?.latestDeployment ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Latest deployment:{' '}
                        <Link
                          href={`/deployments/${serviceStatus.latestDeployment.id}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {truncateUuid(serviceStatus.latestDeployment.id)}
                        </Link>
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        This service has not been deployed yet.
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Runtime defaults: {runtimeDetails.length > 0 ? runtimeDetails.join(' | ') : 'platform defaults'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
              <p className="font-medium text-destructive">Delete this project</p>
              <p className="mt-1 text-xs">
                This permanently removes the project record, deployment history, environment variables, domain claims, membership/invitation data, and managed database records tracked for this project. Managed Postgres resources are deprovisioned as part of deletion when possible.
              </p>
              <p className="mt-2 text-xs">
                Deletion is intentionally blocked while any deployment is queued, building, or running so we do not orphan live runtime or routing state.
              </p>
            </div>

            {!viewer.user ? (
              <p className="text-sm text-muted-foreground">
                Complete account setup before deleting projects from the dashboard.
              </p>
            ) : null}

            {viewer.user && !canDeleteProject ? (
              <p className="text-sm text-muted-foreground">
                Only the current project owner or a platform admin can delete this project.
              </p>
            ) : null}

            {deploymentReadErrorMessage ? (
              <p className="text-sm text-muted-foreground">
                Current deployment activity could not be loaded here. The API will still refuse deletion if any service is queued, building, or running.
              </p>
            ) : null}

            {!deploymentReadErrorMessage && activeDeletionBlockedDeployments.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Deletion is currently blocked</p>
                <p className="mt-1 text-xs">
                  Stop or cancel these active deployments first: {activeDeletionBlockedDeploymentSummary}
                </p>
              </div>
            ) : null}

            {viewer.user && canDeleteProject ? (
              <form action={deleteProjectAction} className="space-y-3 rounded-md border border-destructive/30 p-4">
                <input type="hidden" name="projectId" value={project.id} readOnly />
                <input type="hidden" name="projectName" value={project.name} readOnly />
                <input type="hidden" name="returnPath" value={`/projects/${project.id}`} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="project-delete-confirmation">
                    Type <span className="font-mono text-foreground">{project.name}</span> to confirm project deletion
                  </Label>
                  <Input
                    id="project-delete-confirmation"
                    name="confirmName"
                    placeholder={project.name}
                    autoComplete="off"
                    required
                    disabled={activeDeletionBlockedDeployments.length > 0}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    This cannot be undone from the dashboard.
                  </p>
                  <FormSubmitButton
                    idleText="Delete Project"
                    pendingText="Deleting..."
                    variant="destructive"
                    disabled={activeDeletionBlockedDeployments.length > 0}
                  />
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentReadErrorMessage ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Recent deployments unavailable</p>
                <p className="mt-1 text-xs">{deploymentReadErrorMessage}</p>
              </div>
            ) : sortedDeployments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deployments yet for this project.</p>
            ) : (
              <div className="space-y-2">
                {sortedDeployments.slice(0, 10).map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-xs">{truncateUuid(deployment.id)}</p>
                        <Badge variant="outline">{deployment.serviceName ?? 'app'}</Badge>
                      </div>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Latest Deployment Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentReadErrorMessage ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Latest logs unavailable</p>
                <p className="mt-1 text-xs">{deploymentReadErrorMessage}</p>
              </div>
            ) : latestDeployment ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Deployment {truncateUuid(latestDeployment.id)}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/projects/${project.id}/logs?logsDeploymentId=${latestDeployment.id}`}>Open full logs</Link>
                  </Button>
                </div>
                {latestLogsErrorMessage ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-foreground">
                    <p className="font-medium text-destructive">Latest logs unavailable</p>
                    <p className="mt-1">{latestLogsErrorMessage}</p>
                  </div>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-md border bg-background p-2 font-mono text-xs">
                  {latestLogsErrorMessage ? (
                    <p className="text-muted-foreground">Open the full logs view after restoring live log access.</p>
                  ) : latestLogs.length === 0 ? (
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
        <DashboardUnavailableState
          title="Project data unavailable"
          requestAuth={requestAuth}
          error={error}
          redirectTo={`/projects/${params.id}`}
        />
      </PageLayout>
    );
  }
}
