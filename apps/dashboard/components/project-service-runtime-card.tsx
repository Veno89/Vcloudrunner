import Link from 'next/link';
import { Cpu, FolderTree, Globe2, Network, Rocket, Server } from 'lucide-react';
import {
  buildProjectServiceInternalHostname,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeploymentStatusBadges } from '@/components/deployment-status-badges';
import { FormSubmitButton } from '@/components/form-submit-button';
import { deployProjectAction } from '@/app/deployments/actions';
import {
  formatRelativeTime,
  truncateUuid
} from '@/lib/helpers';
import type { ProjectServiceStatus } from '@/lib/project-service-status';

interface ProjectServiceRuntimeCardProps {
  projectId: string;
  projectName: string;
  projectSlug: string;
  service: ProjectServiceDefinition;
  primaryServiceName: string;
  deploymentHistoryUnavailable: boolean;
  serviceStatus: ProjectServiceStatus | null;
}

function formatRuntimeProfile(service: ProjectServiceDefinition): string {
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

  return runtimeDetails.length > 0 ? runtimeDetails.join(' | ') : 'platform defaults';
}

function ServiceProperty({
  label,
  value,
  icon: Icon,
  tone = 'default',
  monospace = false
}: {
  label: string;
  value: string;
  icon: typeof FolderTree;
  tone?: 'default' | 'primary';
  monospace?: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-4 w-4 text-slate-300" />
        {label}
      </div>
      <p className={`pt-2 text-sm ${tone === 'primary' ? 'text-sky-200' : 'text-slate-100'} ${monospace ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  );
}

export function ProjectServiceRuntimeCard({
  projectId,
  projectName,
  projectSlug,
  service,
  primaryServiceName,
  deploymentHistoryUnavailable,
  serviceStatus
}: ProjectServiceRuntimeCardProps) {
  const latestDeployment = serviceStatus?.latestDeployment ?? null;

  return (
    <Card className="rounded-[2rem] border-white/10 bg-slate-950/60 shadow-[0_24px_64px_rgba(2,6,23,0.22)] backdrop-blur-xl">
      <CardHeader className="space-y-4 border-b border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg text-white">{service.name}</CardTitle>
              <Badge variant={service.exposure === 'public' ? 'default' : 'secondary'}>
                {service.exposure}
              </Badge>
              <Badge variant="outline">{service.kind}</Badge>
              {service.name === primaryServiceName ? (
                <Badge variant="secondary">primary</Badge>
              ) : null}
              {deploymentHistoryUnavailable ? (
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
            <p className="text-sm leading-7 text-slate-400">
              {deploymentHistoryUnavailable
                ? 'Deployment history is temporarily unavailable for this service.'
                : serviceStatus
                  ? `Current deployment state: ${serviceStatus.statusText}.`
                  : 'This service has not been deployed yet.'}
            </p>
          </div>

          <form action={deployProjectAction}>
            <input type="hidden" name="projectId" value={projectId} readOnly />
            <input type="hidden" name="projectName" value={projectName} readOnly />
            <input type="hidden" name="serviceName" value={service.name} readOnly />
            <input type="hidden" name="returnPath" value={`/projects/${projectId}`} readOnly />
            <FormSubmitButton
              idleText={`Deploy ${service.name}`}
              pendingText="Deploying..."
              variant={service.name === primaryServiceName ? 'default' : 'outline'}
              size="sm"
              className={service.name === primaryServiceName ? 'bg-sky-300 text-slate-950 hover:bg-sky-200' : 'border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]'}
            />
          </form>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ServiceProperty
            label="Source Root"
            value={service.sourceRoot}
            icon={FolderTree}
            monospace
          />
          <ServiceProperty
            label="Internal Host"
            value={buildProjectServiceInternalHostname(projectSlug, service.name)}
            icon={Network}
            monospace
          />
          <ServiceProperty
            label="Runtime Profile"
            value={formatRuntimeProfile(service)}
            icon={Server}
          />
          <ServiceProperty
            label="Public URL"
            value={latestDeployment?.runtimeUrl ?? (service.exposure === 'public' ? 'Available after deploy' : 'Internal only')}
            icon={Globe2}
            tone={latestDeployment?.runtimeUrl ? 'primary' : 'default'}
            monospace={Boolean(latestDeployment?.runtimeUrl)}
          />
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Rocket className="h-4 w-4 text-amber-300" />
            Latest Deployment
          </div>
          {latestDeployment ? (
            <div className="pt-3 space-y-2">
              <p className="text-sm text-slate-100">
                Latest deployment {formatRelativeTime(latestDeployment.createdAt)}
              </p>
              <Link
                href={`/deployments/${latestDeployment.id}`}
                className="inline-flex items-center gap-2 text-sm text-sky-200 underline-offset-4 hover:underline"
              >
                <Cpu className="h-4 w-4" />
                {truncateUuid(latestDeployment.id)}
              </Link>
            </div>
          ) : (
            <p className="pt-3 text-sm text-slate-400">
              Trigger a deployment to populate runtime details and public URLs.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
