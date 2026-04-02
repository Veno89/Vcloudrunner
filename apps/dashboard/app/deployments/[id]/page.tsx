import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardAuthRequiredState } from '@/components/dashboard-auth-required-state';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { DeploymentAutoRefresh } from '@/components/deployment-auto-refresh';
import { FormSubmitButton } from '@/components/form-submit-button';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import { ActionToast } from '@/components/action-toast';
import { DeploymentStatusTip, RedeployTip, RollbackTip } from '@/components/onboarding/deployment-tips';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { PageLayout } from '@/components/page-layout';
import { loadDashboardData } from '@/lib/loaders';
import { apiAuthToken, fetchDeploymentLogs } from '@/lib/api';
import {
  describeDashboardLiveDataFailure,
  formatDeploymentStatusText,
  hasRequestedCancellation,
  logLevelTextClassName,
  truncateUuid
} from '@/lib/helpers';
import { redeployAction, rollbackAction } from '../actions';
import Link from 'next/link';

interface DeploymentDetailPageProps {
  params: { id: string };
  searchParams?: {
    status?: 'success' | 'error';
    message?: string;
  };
}

export default async function DeploymentDetailPage({ params, searchParams }: DeploymentDetailPageProps) {
  const data = await loadDashboardData();

  if (!data.usingLiveData) {
    return (
      <PageLayout>
        {data.authRequirement ? (
          <DashboardAuthRequiredState
            requirement={data.authRequirement}
            redirectTo={`/deployments/${params.id}`}
          />
        ) : (
          <LiveDataUnavailableState
            title="Deployment details unavailable"
            description={data.liveDataErrorMessage ?? 'Deployment details are temporarily unavailable.'}
            actionHref="/deployments"
            actionLabel="Back to Deployments"
          />
        )}
      </PageLayout>
    );
  }

  const match = data.sortedDeployments.find(
    (item) => item.deployment.id === params.id
  );

  if (!match) {
    if (data.liveDataErrorMessage) {
      return (
        <PageLayout>
          <LiveDataUnavailableState
            title="Deployment details unavailable"
            description={data.liveDataErrorMessage}
            actionHref="/deployments"
            actionLabel="Back to Deployments"
          />
        </PageLayout>
      );
    }

    return (
      <PageLayout>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployment Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The requested deployment does not exist or is no longer available.
          </p>
        </div>
        <Link href="/deployments" className="text-sm text-primary hover:underline">
          &larr; Back to Deployments
        </Link>
      </PageLayout>
    );
  }

  const { deployment, project } = match;
  const refreshedAt = new Date().toISOString();
  const cancellationRequested = hasRequestedCancellation(deployment.metadata);
  const statusText = formatDeploymentStatusText(deployment.status, cancellationRequested);

  let logs: Array<{ level: string; message: string; timestamp: string }> = [];
  let logsErrorMessage: string | null = null;
  try {
    logs = await fetchDeploymentLogs(project.id, deployment.id, 50);
  } catch (error) {
    logsErrorMessage = describeDashboardLiveDataFailure({
      error,
      hasDemoUserId: true,
      hasApiAuthToken: Boolean(apiAuthToken)
    });
  }

  const runtimeStarted = hasRuntimeStarted(logs);
  const failureSummary = deployment.status === 'failed' ? deriveFailureSummary(logs) : null;
  const timelineSteps = buildDeploymentSteps({
    status: deployment.status,
    cancellationRequested,
    runtimeUrl: deployment.runtimeUrl,
    logs,
    startedAt: deployment.startedAt ?? undefined,
    finishedAt: deployment.finishedAt ?? undefined,
  });

  const statusGuidance =
    deployment.status === 'running'
      ? deployment.runtimeUrl
        ? 'Deployment is healthy and serving traffic.'
        : 'Deployment is running, but no public runtime URL is currently available. Review recent logs for route configuration details.'
      : deployment.status === 'building' && cancellationRequested
        ? 'Cancellation requested. The worker should stop this deployment before it reaches a running state.'
        : deployment.status === 'queued' && cancellationRequested
          ? 'Cancellation requested. This deployment should stop before worker execution begins.'
      : deployment.status === 'building'
        ? 'Build is in progress. Logs will update as steps complete.'
      : deployment.status === 'queued'
          ? 'Deployment is queued and waiting for worker capacity.'
          : deployment.status === 'stopped'
            ? runtimeStarted
              ? 'Deployment was stopped after startup. The runtime is no longer active. Review recent logs for cancellation or cleanup details.'
              : deployment.startedAt
                ? 'Deployment was stopped after work began, before it remained active. Review recent logs for cancellation or worker-stop details.'
                : 'Deployment was stopped before reaching a running state. Review recent logs for cancellation or worker-stop details.'
          : deployment.status === 'failed'
            ? 'Deployment failed. Review logs to identify the failure point.'
            : 'Deployment state is unknown. Check recent logs for details.';
  const runtimeUrlLabel =
    deployment.status === 'running'
      ? deployment.runtimeUrl
        ? null
        : 'not currently available'
      : deployment.status === 'failed'
        ? 'inactive after failure'
        : deployment.status === 'stopped'
          ? runtimeStarted
            ? 'inactive after stop'
            : 'inactive'
          : cancellationRequested
          ? 'not expected while cancellation is pending'
          : 'pending';
  const deploymentService = getDeploymentServiceMetadata(deployment.serviceName, deployment.metadata);

  return (
    <PageLayout>
      <div className="flex items-center gap-3">
        <Link href="/deployments" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Deployments
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold tracking-tight">
          {project.name} / <span className="font-mono">{truncateUuid(deployment.id)}</span>
        </h1>
        <DeploymentStatusBadges
          status={deployment.status}
          cancellationRequested={cancellationRequested}
        />
        <DeploymentStatusTip />
        {deploymentService ? (
          <>
            <Badge variant="secondary">{deploymentService.name}</Badge>
            {deploymentService.kind ? (
              <Badge variant="outline">{deploymentService.kind}</Badge>
            ) : null}
            {deploymentService.exposure ? (
              <Badge variant={deploymentService.exposure === 'public' ? 'default' : 'secondary'}>
                {deploymentService.exposure}
              </Badge>
            ) : null}
          </>
        ) : null}
        <Link href={`/projects/${project.id}`} className="text-sm text-primary hover:underline">
          View Project
        </Link>
      </div>

      <DeploymentAutoRefresh status={deployment.status} />
      <LastRefreshedIndicator refreshedAt={refreshedAt} staleAfterSeconds={15} />

      {data.liveDataErrorMessage ? (
        <DemoModeBanner title="Partial outage" detail={data.liveDataErrorMessage}>
          This deployment is available, but some surrounding deployment history is temporarily unavailable.
        </DemoModeBanner>
      ) : null}

      <ActionToast
        status={searchParams?.status}
        message={searchParams?.message}
        fallbackErrorMessage="Deployment action failed."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{statusGuidance}</p>
          {deploymentService ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Target service:</span>
              <Badge variant="secondary">{deploymentService.name}</Badge>
              {deploymentService.kind ? (
                <Badge variant="outline">{deploymentService.kind}</Badge>
              ) : null}
              {deploymentService.exposure ? (
                <Badge variant={deploymentService.exposure === 'public' ? 'default' : 'secondary'}>
                  {deploymentService.exposure}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {logsErrorMessage ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-foreground">
              <p className="font-medium text-destructive">Recent logs unavailable</p>
              <p className="mt-1">{logsErrorMessage}</p>
            </div>
          ) : null}
          {failureSummary && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
              <p className="font-medium text-destructive">Failure Summary</p>
              <p className="mt-1 text-foreground">{failureSummary}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <form action={redeployAction}>
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <input type="hidden" name="deploymentId" value={deployment.id} readOnly />
              <input type="hidden" name="returnPath" value={`/deployments/${deployment.id}`} readOnly />
              <FormSubmitButton
                idleText={deploymentService ? `Redeploy ${deploymentService.name}` : 'Redeploy'}
                pendingText="Redeploying..."
                variant="outline"
                size="sm"
              />
            </form>
            <RedeployTip />
            {(deployment.status === 'failed' || deployment.status === 'stopped') ? (
              <>
                <form action={rollbackAction}>
                  <input type="hidden" name="projectId" value={project.id} readOnly />
                  <input type="hidden" name="deploymentId" value={deployment.id} readOnly />
                  <input type="hidden" name="returnPath" value={`/deployments/${deployment.id}`} readOnly />
                  <FormSubmitButton
                    idleText="Rollback to this"
                    pendingText="Rolling back..."
                    variant="outline"
                    size="sm"
                  />
                </form>
                <RollbackTip />
              </>
            ) : null}
            <Link
              href={`/projects/${project.id}/logs?logsDeploymentId=${deployment.id}`}
              className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
            >
              Open Full Logs
            </Link>
            <Link
              href={`/projects/${project.id}`}
              className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
            >
              Open Project Overview
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Deployment ID" value={deployment.id} mono />
            <DetailRow label="Project" value={project.name} />
            {deploymentService ? (
              <DetailRow label="Service" value={deploymentService.name} />
            ) : null}
            <DetailRow label="Status" value={statusText} />
            {cancellationRequested && (deployment.status === 'queued' || deployment.status === 'building') ? (
              <DetailRow label="Cancellation" value="requested" />
            ) : null}
            <DetailRow label="Commit" value={deployment.commitSha ?? 'unknown'} mono />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Runtime URL</p>
              {deployment.status === 'running' && deployment.runtimeUrl ? (
                <a
                  href={deployment.runtimeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary underline-offset-2 hover:underline"
                >
                  {deployment.runtimeUrl}
                </a>
              ) : (
                <p className="text-muted-foreground">{runtimeUrlLabel}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-xs">
                {timelineSteps.map((step) => (
                  <li
                    key={step.id}
                    className="rounded-md border bg-background px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{step.label}</span>
                      <Badge variant={stepStateVariant(step.state)} className="uppercase tracking-wide">
                        {step.state}
                      </Badge>
                    </div>
                    {step.detail ? <p className="mt-1 text-muted-foreground">{step.detail}</p> : null}
                  </li>
                ))}
              </ul>

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
                {logsErrorMessage ? (
                  <p className="text-muted-foreground">Restore live log access, then refresh this page to inspect deployment logs.</p>
                ) : logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs captured for this deployment yet.</p>
                ) : (
                  logs.map((log, index) => (
                    <p
                      key={`${log.timestamp}-${index}`}
                      className="mb-1 whitespace-pre-wrap break-words"
                    >
                      <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                      <span className={logLevelTextClassName(log.level)}>{log.level.toUpperCase()}</span> {log.message}
                    </p>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

type DeploymentStepState = 'complete' | 'current' | 'upcoming' | 'failed' | 'warning';

interface DeploymentStep {
  id: 'queued' | 'build' | 'start' | 'route';
  label: string;
  state: DeploymentStepState;
  detail?: string;
}


function stepStateVariant(state: DeploymentStepState) {
  if (state === 'complete') return 'success' as const;
  if (state === 'current') return 'warning' as const;
  if (state === 'warning') return 'warning' as const;
  if (state === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}

function buildDeploymentSteps({
  status,
  cancellationRequested,
  runtimeUrl,
  logs,
  startedAt,
  finishedAt,
}: {
  status: DeploymentStatus;
  cancellationRequested?: boolean;
  runtimeUrl?: string | null;
  logs: Array<{ level: string; message: string; timestamp: string }>;
  startedAt?: string;
  finishedAt?: string;
}): DeploymentStep[] {
  const failedStep = detectFailedStep(logs);
  const routeProgress = detectRouteProgress(logs);
  const runtimeStarted = hasRuntimeStarted(logs);

  if (status === 'running') {
    return [
      { id: 'queued', label: 'Queued', state: 'complete', detail: 'Worker capacity was allocated.' },
      { id: 'build', label: 'Build', state: 'complete', detail: 'Source fetched and image built.' },
      { id: 'start', label: 'Start', state: 'complete', detail: 'Runtime container started successfully.' },
      {
        id: 'route',
        label: 'Route',
        state: runtimeUrl ? 'complete' : 'warning',
        detail: runtimeUrl
          ? 'Public routing is active.'
          : routeProgress === 'skipped'
            ? 'Public route configuration was skipped. Review recent logs for Caddy or ingress details.'
            : 'No public route is currently available for this deployment.'
      },
    ];
  }

  if (status === 'queued') {
    return [
      {
        id: 'queued',
        label: 'Queued',
        state: cancellationRequested ? 'warning' : 'current',
        detail: cancellationRequested
          ? 'Cancellation requested. The worker should stop this deployment before execution begins.'
          : 'Waiting for worker capacity.'
      },
      { id: 'build', label: 'Build', state: 'upcoming' },
      { id: 'start', label: 'Start', state: 'upcoming' },
      { id: 'route', label: 'Route', state: 'upcoming' },
    ];
  }

  if (status === 'building') {
    return [
      { id: 'queued', label: 'Queued', state: 'complete', detail: startedAt ? `Started at ${new Date(startedAt).toLocaleString()}` : undefined },
      {
        id: 'build',
        label: 'Build',
        state: cancellationRequested ? 'warning' : 'current',
        detail: cancellationRequested
          ? 'Cancellation requested. The worker should stop this deployment before activation.'
          : 'Build logs are still streaming.'
      },
      { id: 'start', label: 'Start', state: 'upcoming' },
      { id: 'route', label: 'Route', state: 'upcoming' },
    ];
  }

  if (status === 'failed') {
    const failureDetail = finishedAt
      ? `Marked failed at ${new Date(finishedAt).toLocaleString()}`
      : 'Marked failed before completion.';

    return [
      {
        id: 'queued',
        label: 'Queued',
        state: failedStep === 'queued' ? 'failed' : 'complete',
        detail: failedStep === 'queued' ? failureDetail : undefined,
      },
      {
        id: 'build',
        label: 'Build',
        state: failedStep === 'build' ? 'failed' : failedStep === 'queued' ? 'upcoming' : 'complete',
        detail: failedStep === 'build' ? failureDetail : undefined,
      },
      {
        id: 'start',
        label: 'Start',
        state:
          failedStep === 'start'
            ? 'failed'
            : failedStep === 'queued' || failedStep === 'build'
              ? 'upcoming'
              : 'complete',
        detail: failedStep === 'start' ? failureDetail : undefined,
      },
      {
        id: 'route',
        label: 'Route',
        state:
          failedStep === 'route'
            ? 'failed'
            : failedStep === 'queued' || failedStep === 'build' || failedStep === 'start'
              ? 'upcoming'
              : 'complete',
        detail: failedStep === 'route' ? failureDetail : undefined,
      },
    ];
  }

  if (status === 'stopped') {
    const stopDetail = finishedAt
      ? `Stopped at ${new Date(finishedAt).toLocaleString()}`
      : runtimeStarted
        ? 'Deployment stopped after runtime startup.'
        : startedAt
          ? 'Deployment stopped before runtime startup.'
          : 'Deployment stopped before activation.';

    return [
      {
        id: 'queued',
        label: 'Queued',
        state: 'complete',
        detail: startedAt ? `Worker started at ${new Date(startedAt).toLocaleString()}` : 'Queued successfully.'
      },
      {
        id: 'build',
        label: 'Build',
        state: startedAt ? 'complete' : 'upcoming',
        detail: startedAt
          ? runtimeStarted
            ? 'Build completed before the deployment was stopped.'
            : 'Deployment work began before it was stopped.'
          : undefined
      },
      {
        id: 'start',
        label: 'Start',
        state: runtimeStarted ? 'complete' : startedAt ? 'warning' : 'upcoming',
        detail: runtimeStarted
          ? `Runtime startup completed before the deployment was stopped. ${stopDetail}`
          : stopDetail
      },
      {
        id: 'route',
        label: 'Route',
        state:
          routeProgress === 'configured'
            ? 'complete'
            : routeProgress === 'skipped' || runtimeStarted
              ? 'warning'
              : 'upcoming',
        detail:
          routeProgress === 'configured'
            ? 'Public route was active before the deployment was stopped.'
            : routeProgress === 'skipped'
              ? 'Public route configuration was skipped before the deployment was stopped.'
              : runtimeStarted
                ? 'No public route was available before the deployment was stopped.'
                : undefined
      },
    ];
  }

  return [
    { id: 'queued', label: 'Queued', state: 'current' },
    { id: 'build', label: 'Build', state: 'upcoming' },
    { id: 'start', label: 'Start', state: 'upcoming' },
    { id: 'route', label: 'Route', state: 'upcoming' },
  ];
}

function detectFailedStep(logs: Array<{ level: string; message: string }>): DeploymentStep['id'] {
  const failedLog = [...logs].reverse().find((entry) => {
    const level = entry.level.toLowerCase();
    return level === 'error' || level === 'fatal';
  });

  const source = failedLog?.message.toLowerCase() ?? '';

  if (source.includes('queue') || source.includes('stuck')) {
    return 'queued';
  }

  if (source.includes('build') || source.includes('dockerfile') || source.includes('npm') || source.includes('pnpm') || source.includes('yarn')) {
    return 'build';
  }

  if (source.includes('start') || source.includes('container') || source.includes('port') || source.includes('runtime')) {
    return 'start';
  }

  if (source.includes('route') || source.includes('caddy') || source.includes('domain') || source.includes('proxy')) {
    return 'route';
  }

  return 'build';
}

function detectRouteProgress(
  logs: Array<{ level: string; message: string }>
): 'configured' | 'skipped' | 'none' {
  for (const entry of logs) {
    const message = entry.message.toLowerCase();
    if (message.includes('route configured')) {
      return 'configured';
    }

    if (message.includes('route configuration skipped')) {
      return 'skipped';
    }
  }

  return 'none';
}

function hasRuntimeStarted(logs: Array<{ level: string; message: string }>) {
  return logs.some((entry) => {
    const message = entry.message.toLowerCase();
    return (
      message.includes('deployment running')
      || message.includes('route configured')
      || message.includes('route configuration skipped')
    );
  });
}

function getDeploymentServiceMetadata(
  serviceName: string | null | undefined,
  metadata: unknown
): {
  name: string;
  kind?: 'web' | 'worker';
  exposure?: 'public' | 'internal';
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return typeof serviceName === 'string' && serviceName.length > 0
      ? { name: serviceName }
      : null;
  }

  const service = (metadata as { service?: unknown }).service;

  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    return typeof serviceName === 'string' && serviceName.length > 0
      ? { name: serviceName }
      : null;
  }

  const name = typeof (service as { name?: unknown }).name === 'string'
    ? (service as { name: string }).name
    : typeof serviceName === 'string' && serviceName.length > 0
      ? serviceName
    : null;
  const kind = (service as { kind?: unknown }).kind;
  const exposure = (service as { exposure?: unknown }).exposure;

  if (!name) {
    return null;
  }

  return {
    name,
    ...(kind === 'web' || kind === 'worker' ? { kind } : {}),
    ...(exposure === 'public' || exposure === 'internal' ? { exposure } : {})
  };
}

function deriveFailureSummary(logs: Array<{ level: string; message: string }>): string | null {
  const failedLog = [...logs].reverse().find((entry) => {
    const level = entry.level.toLowerCase();
    return level === 'error' || level === 'fatal';
  });

  if (!failedLog) {
    return null;
  }

  const message = failedLog.message
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/^deployment failed\s*[:-]?\s*/i, '')
    .replace(/^state_reconciliation\s*:\s*/i, 'Container reconciliation failed: ')
    .trim();

  if (message.length === 0) {
    return 'Deployment failed due to an unknown runtime error.';
  }

  return message;
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
