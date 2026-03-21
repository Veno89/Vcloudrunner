import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemoModeBanner } from '@/components/demo-mode-banner';
import { DeploymentAutoRefresh } from '@/components/deployment-auto-refresh';
import { FormSubmitButton } from '@/components/form-submit-button';
import { LastRefreshedIndicator } from '@/components/last-refreshed-indicator';
import { ActionToast } from '@/components/action-toast';
import { LiveDataUnavailableState } from '@/components/live-data-unavailable-state';
import { PageLayout } from '@/components/page-layout';
import { loadDashboardData } from '@/lib/loaders';
import { apiAuthToken, fetchDeploymentLogs } from '@/lib/api';
import { describeDashboardLiveDataFailure, logLevelTextClassName, truncateUuid } from '@/lib/helpers';
import { deployProjectAction } from '../actions';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
    redirect('/deployments');
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

  const failureSummary = deployment.status === 'failed' ? deriveFailureSummary(logs) : null;
  const timelineSteps = buildDeploymentSteps({
    status: deployment.status,
    logs,
    startedAt: deployment.startedAt ?? undefined,
    finishedAt: deployment.finishedAt ?? undefined,
  });

  const statusVariant =
    deployment.status === 'running'
      ? 'success'
      : deployment.status === 'building' || deployment.status === 'queued'
        ? 'warning'
        : deployment.status === 'failed'
          ? 'destructive'
          : 'secondary';

  const statusGuidance =
    deployment.status === 'running'
      ? 'Deployment is healthy and serving traffic.'
      : deployment.status === 'building'
        ? 'Build is in progress. Logs will update as steps complete.'
        : deployment.status === 'queued'
          ? 'Deployment is queued and waiting for worker capacity.'
          : deployment.status === 'stopped'
            ? 'Deployment was stopped before reaching a running state. Review recent logs for cancellation or worker-stop details.'
          : deployment.status === 'failed'
            ? 'Deployment failed. Review logs to identify the failure point.'
            : 'Deployment state is unknown. Check recent logs for details.';
  const runtimeUrlLabel =
    deployment.status === 'running'
      ? deployment.runtimeUrl
        ? null
        : 'pending'
      : deployment.status === 'failed'
        ? 'inactive after failure'
        : deployment.status === 'stopped'
          ? 'inactive'
          : 'pending';

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
        <Badge variant={statusVariant}>{deployment.status}</Badge>
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
          <div className="flex flex-wrap gap-2">
            <form action={deployProjectAction}>
              <input type="hidden" name="projectId" value={project.id} readOnly />
              <input type="hidden" name="projectName" value={project.name} readOnly />
              <input type="hidden" name="returnPath" value={`/deployments/${deployment.id}`} readOnly />
              <FormSubmitButton
                idleText="Redeploy"
                pendingText="Redeploying..."
                variant="outline"
                size="sm"
              />
            </form>
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
            <DetailRow label="Status" value={deployment.status} />
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

type DeploymentStepState = 'complete' | 'current' | 'upcoming' | 'failed';

interface DeploymentStep {
  id: 'queued' | 'build' | 'start' | 'route';
  label: string;
  state: DeploymentStepState;
  detail?: string;
}


function stepStateVariant(state: DeploymentStepState) {
  if (state === 'complete') return 'success' as const;
  if (state === 'current') return 'warning' as const;
  if (state === 'failed') return 'destructive' as const;
  return 'secondary' as const;
}

function buildDeploymentSteps({
  status,
  logs,
  startedAt,
  finishedAt,
}: {
  status: DeploymentStatus;
  logs: Array<{ level: string; message: string; timestamp: string }>;
  startedAt?: string;
  finishedAt?: string;
}): DeploymentStep[] {
  const failedStep = detectFailedStep(logs);

  if (status === 'running') {
    return [
      { id: 'queued', label: 'Queued', state: 'complete', detail: 'Worker capacity was allocated.' },
      { id: 'build', label: 'Build', state: 'complete', detail: 'Source fetched and image built.' },
      { id: 'start', label: 'Start', state: 'complete', detail: 'Runtime container started successfully.' },
      { id: 'route', label: 'Route', state: 'complete', detail: 'Public routing is active.' },
    ];
  }

  if (status === 'queued') {
    return [
      { id: 'queued', label: 'Queued', state: 'current', detail: 'Waiting for worker capacity.' },
      { id: 'build', label: 'Build', state: 'upcoming' },
      { id: 'start', label: 'Start', state: 'upcoming' },
      { id: 'route', label: 'Route', state: 'upcoming' },
    ];
  }

  if (status === 'building') {
    return [
      { id: 'queued', label: 'Queued', state: 'complete', detail: startedAt ? `Started at ${new Date(startedAt).toLocaleString()}` : undefined },
      { id: 'build', label: 'Build', state: 'current', detail: 'Build logs are still streaming.' },
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
        detail: startedAt ? 'Deployment work began before it was stopped.' : undefined
      },
      { id: 'start', label: 'Start', state: 'upcoming', detail: stopDetail },
      { id: 'route', label: 'Route', state: 'upcoming' },
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
