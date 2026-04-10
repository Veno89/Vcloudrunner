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
    <div className="rounded-2xl border bg-background/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={`pt-2 text-sm ${tone === 'primary' ? 'text-primary' : 'text-foreground'} ${monospace ? 'font-mono text-xs' : ''}`}>
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
    <Card className="rounded-2xl border-border/80">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{service.name}</CardTitle>
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
            <p className="text-sm text-muted-foreground">
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

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Rocket className="h-4 w-4" />
            Latest Deployment
          </div>
          {latestDeployment ? (
            <div className="pt-3 space-y-2">
              <p className="text-sm text-foreground">
                Latest deployment {formatRelativeTime(latestDeployment.createdAt)}
              </p>
              <Link
                href={`/deployments/${latestDeployment.id}`}
                className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
              >
                <Cpu className="h-4 w-4" />
                {truncateUuid(latestDeployment.id)}
              </Link>
            </div>
          ) : (
            <p className="pt-3 text-sm text-muted-foreground">
              Trigger a deployment to populate runtime details and public URLs.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
