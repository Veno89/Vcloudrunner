import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPrimaryProjectService } from '@vcloudrunner/shared-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardUnavailableState } from '@/components/dashboard-unavailable-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { ProjectSubnav } from '@/components/project-subnav';
import { FormSubmitButton } from '@/components/form-submit-button';
import { ActionToast } from '@/components/action-toast';
import { PageLayout } from '@/components/page-layout';
import { ProjectTourClient } from '@/components/onboarding/project-tour-client';
import { ProjectOverviewMetrics } from '@/components/project-overview-metrics';
import { ProjectServiceRuntimeCard } from '@/components/project-service-runtime-card';
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
import { deployAllServicesAction } from '@/app/deployments/actions';

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

    const latestDeployment = sortedDeployments[0] ?? null;
    const domainCount = projectDomainsReadErrorMessage ? null : Math.max(projectDomains.length, 1);
    const latestDeploymentRelative = latestDeployment ? formatRelativeTime(latestDeployment.createdAt) : null;
    const publicServiceCount = project.services.filter((service) => service.exposure === 'public').length;
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
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl lg:p-7">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Link href="/projects" className="hover:text-white">
              Projects
            </Link>
            <span>/</span>
            <span className="text-slate-200">{project.name}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{project.name}</h1>
                <p className="text-sm leading-7 text-slate-400">{project.gitRepositoryUrl}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs text-sky-200">{routeSummary.host}</p>
                <Badge variant={routeSummary.variant} className="border-white/10">
                  {routeSummary.label}
                </Badge>
                <Badge variant={composedProjectStatus.variant} className="border-white/10">
                  {composedProjectStatus.label}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Services</p>
                  <p className="pt-2 text-2xl font-semibold text-white">{project.services.length}</p>
                  <p className="pt-1 text-xs text-slate-500">
                    {publicServiceCount} public / {Math.max(project.services.length - publicServiceCount, 0)} internal
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary Service</p>
                  <p className="pt-2 text-lg font-semibold text-white">{primaryService.name}</p>
                  <p className="pt-1 text-xs text-slate-500">Current public entry point</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Default Branch</p>
                  <p className="pt-2 font-mono text-sm text-slate-100">{project.defaultBranch}</p>
                  <p className="pt-1 text-xs text-slate-500">Source branch used for new deploys</p>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
              <Link href="/projects">Back to Projects</Link>
            </Button>
          </div>
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

        <ProjectOverviewMetrics
          statusLabel={composedProjectStatus.label}
          statusVariant={composedProjectStatus.variant}
          statusBreakdown={composedServiceStatusBreakdown}
          deploymentCount={deploymentReadErrorMessage ? null : sortedDeployments.length}
          latestDeploymentRelative={latestDeploymentRelative}
          domainCount={domainCount}
          primaryHost={routeSummary.host}
          routeLabel={routeSummary.label}
          routeVariant={routeSummary.variant}
        />

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-white/10">
              <div className="space-y-1">
                <CardTitle className="text-base text-white">Services</CardTitle>
                <p className="text-sm leading-7 text-slate-400">
                  Operational details stay here. Lower-frequency configuration counts move to the side.
                </p>
              </div>
              {project.services.length > 1 && (
                <form action={deployAllServicesAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="returnPath" value={`/projects/${project.id}`} />
                  <FormSubmitButton
                    idleText="Deploy All"
                    pendingText="Deploying..."
                    variant="outline"
                    size="sm"
                    className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]"
                  />
                </form>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-400">
                Project environment variables remain shared at the project level. Deployments also receive generated
                <span className="font-mono text-slate-100"> VCLOUDRUNNER_SERVICE_* </span>
                discovery variables plus a stable internal host per service on the worker network.
              </div>

              <div className="space-y-3">
                {project.services.map((service) => (
                  <ProjectServiceRuntimeCard
                    key={service.name}
                    projectId={project.id}
                    projectName={project.name}
                    projectSlug={project.slug}
                    service={service}
                    primaryServiceName={primaryService.name}
                    deploymentHistoryUnavailable={Boolean(deploymentReadErrorMessage)}
                    serviceStatus={serviceStatusesByName.get(service.name) ?? null}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-base text-white">Configuration Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Environment Variables
                  </p>
                  {environmentReadErrorMessage ? (
                    <div className="pt-2 space-y-1">
                      <p className="text-2xl font-semibold text-white">Unavailable</p>
                      <p className="text-xs text-slate-500">Environment variables could not be loaded.</p>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-1">
                      <p className="text-2xl font-semibold text-white">{environmentVariables.length}</p>
                      <p className="text-xs text-slate-500">
                        Project-wide configuration shared across services.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Managed Databases
                  </p>
                  {projectDatabasesReadErrorMessage ? (
                    <div className="pt-2 space-y-1">
                      <p className="text-2xl font-semibold text-white">Unavailable</p>
                      <p className="text-xs text-slate-500">Managed databases could not be loaded.</p>
                    </div>
                  ) : (
                    <div className="pt-2 space-y-2">
                      <p className="text-2xl font-semibold text-white">{projectDatabases.length}</p>
                      <Badge variant={databaseSummary.variant} className="w-fit border-white/10">
                        {databaseSummary.label}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Administrative controls
                  </p>
                  <p className="pt-2 text-sm leading-7 text-slate-400">
                    Ownership, access management, and destructive project actions now live under Settings and Members so this overview can stay operational.
                  </p>
                  <div className="pt-3">
                    <Button asChild variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                      <Link href={`/projects/${project.id}/settings`}>Open Settings</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="text-base text-white">Recent Deployments</CardTitle>
              </CardHeader>
              <CardContent>
                {deploymentReadErrorMessage ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                    <p className="font-medium text-destructive">Recent deployments unavailable</p>
                    <p className="mt-1 text-xs">{deploymentReadErrorMessage}</p>
                  </div>
                ) : sortedDeployments.length === 0 ? (
                  <p className="text-sm text-slate-400">No deployments yet for this project.</p>
                ) : (
                  <div className="space-y-2">
                    {sortedDeployments.slice(0, 8).map((deployment) => (
                      <div
                        key={deployment.id}
                        className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-3 py-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-xs text-slate-100">{truncateUuid(deployment.id)}</p>
                            <Badge variant="outline" className="border-white/10 text-slate-200">{deployment.serviceName ?? 'app'}</Badge>
                          </div>
                          <p className="text-xs text-slate-500" title={new Date(deployment.createdAt).toLocaleString()}>
                            {formatRelativeTime(deployment.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <DeploymentStatusBadges
                            status={deployment.status}
                            cancellationRequested={hasRequestedCancellation(deployment.metadata)}
                          />
                          <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                            <Link href={`/deployments/${deployment.id}`}>View</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="text-sm text-white">Latest Deployment Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {deploymentReadErrorMessage ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                <p className="font-medium text-destructive">Latest logs unavailable</p>
                <p className="mt-1 text-xs">{deploymentReadErrorMessage}</p>
              </div>
            ) : latestDeployment ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Deployment {truncateUuid(latestDeployment.id)}</span>
                  <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:bg-white/10 hover:text-white">
                    <Link href={`/projects/${project.id}/logs?logsDeploymentId=${latestDeployment.id}`}>Open full logs</Link>
                  </Button>
                </div>
                {latestLogsErrorMessage ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-foreground">
                    <p className="font-medium text-destructive">Latest logs unavailable</p>
                    <p className="mt-1">{latestLogsErrorMessage}</p>
                  </div>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-3 font-mono text-xs">
                  {latestLogsErrorMessage ? (
                    <p className="text-slate-500">Open the full logs view after restoring live log access.</p>
                  ) : latestLogs.length === 0 ? (
                    <p className="text-slate-500">No logs captured yet.</p>
                  ) : (
                    latestLogs.map((log, index) => (
                      <p key={`${log.timestamp}-${index}`} className="mb-1 whitespace-pre-wrap break-words">
                        <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                        <span className={logLevelTextClassName(log.level)}>{log.level.toUpperCase()}</span> {log.message}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Trigger a deployment to see logs.</p>
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
