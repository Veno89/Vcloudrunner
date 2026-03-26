import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildProjectServiceInternalHostname,
  getPrimaryProjectService
} from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { ProjectSubnav } from '@/components/project-subnav';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ActionToast } from '@/components/action-toast';
import { PageLayout } from '@/components/page-layout';
import {
  apiAuthToken,
  fetchProjectsForCurrentUser,
  fetchDeploymentsForProject,
  fetchEnvironmentVariables,
  fetchDeploymentLogs,
  resolveViewerContext,
} from '@/lib/api';
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


export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return (
      <PageLayout>
        <LiveDataUnavailableState
          description={describeDashboardLiveDataFailure({
            ...(viewerContextError ? { error: viewerContextError } : {}),
            hasDemoUserId: false,
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
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

    const [deploymentsResult, environmentVariablesResult] = await Promise.allSettled([
      fetchDeploymentsForProject(project.id),
      fetchEnvironmentVariables(project.id),
    ]);
    const deployments =
      deploymentsResult.status === 'fulfilled' ? deploymentsResult.value : [];
    const environmentVariables =
      environmentVariablesResult.status === 'fulfilled' ? environmentVariablesResult.value : [];
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
    const partialOutageDetail = [
      deploymentReadErrorMessage ? `Deployment history unavailable. ${deploymentReadErrorMessage}` : null,
      environmentReadErrorMessage ? `Environment variables unavailable. ${environmentReadErrorMessage}` : null
    ]
      .filter((message): message is string => Boolean(message))
      .join(' ');

    const sortedDeployments = deployments
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const primaryService = getPrimaryProjectService(project.services);
    const serviceStatuses = createProjectServiceStatuses(project.services, sortedDeployments);
    const serviceStatusesByName = new Map(
      serviceStatuses.map((serviceStatus) => [serviceStatus.service.name, serviceStatus])
    );
    const composedProjectStatus = composeProjectStatus(serviceStatuses);
    const composedServiceStatusBreakdown = formatProjectServiceStatusBreakdown(serviceStatuses);

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
            <p className="text-sm text-primary">{project.slug}.apps.platform.example.com</p>
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

        {partialOutageDetail ? (
          <DemoModeBanner title="Partial outage" detail={partialOutageDetail}>
            Some project detail panels are temporarily unavailable, but the project page is still live.
          </DemoModeBanner>
        ) : null}

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
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Project Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <form action={deployProjectAction}>
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <input type="hidden" name="projectName" value={project.name} readOnly />
              <input type="hidden" name="serviceName" value={primaryService.name} readOnly />
              <input type="hidden" name="returnPath" value={`/projects/${project.id}`} readOnly />
              <FormSubmitButton
                idleText={`Deploy ${primaryService.name}`}
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
            <CardTitle className="text-sm">Services</CardTitle>
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
                      Runtime defaults: {runtimeDetails.length > 0 ? runtimeDetails.join(' · ') : 'platform defaults'}
                    </p>
                  </div>
                );
              })}
            </div>
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
        <LiveDataUnavailableState
          title="Project data unavailable"
          description={describeDashboardLiveDataFailure({
            error,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: Boolean(apiAuthToken)
          })}
        />
      </PageLayout>
    );
  }
}
