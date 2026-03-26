import type {
  DeploymentStatus,
  ProjectServiceDefinition
} from '@vcloudrunner/shared-types';
import {
  DEFAULT_PROJECT_SERVICE_NAME,
  normalizeProjectServices
} from '@vcloudrunner/shared-types';

import type { ApiDeployment } from './api';
import { formatDeploymentStatusText, hasRequestedCancellation } from './helpers';

export type DashboardStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info';

export interface ProjectServiceStatus {
  service: ProjectServiceDefinition;
  latestDeployment: ApiDeployment | null;
  statusText: string;
  statusVariant: DashboardStatusBadgeVariant;
  deploymentStatus?: DeploymentStatus;
  cancellationRequested: boolean;
}

export interface ComposedProjectStatus {
  label: string;
  variant: DashboardStatusBadgeVariant;
}

function deploymentStatusVariant(status: DeploymentStatus): DashboardStatusBadgeVariant {
  if (status === 'running') {
    return 'success';
  }

  if (status === 'queued' || status === 'building') {
    return 'warning';
  }

  if (status === 'failed') {
    return 'destructive';
  }

  return 'secondary';
}

function resolveDeploymentServiceName(deployment: Pick<ApiDeployment, 'serviceName'>): string {
  const normalizedServiceName = deployment.serviceName?.trim();

  return normalizedServiceName && normalizedServiceName.length > 0
    ? normalizedServiceName
    : DEFAULT_PROJECT_SERVICE_NAME;
}

function sortDeploymentsByCreatedAt(
  left: Pick<ApiDeployment, 'createdAt'>,
  right: Pick<ApiDeployment, 'createdAt'>
): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function statusPriority(statusText: string): number {
  if (statusText === 'failed') {
    return 0;
  }

  if (statusText.includes('cancelling')) {
    return 1;
  }

  if (statusText === 'queued') {
    return 2;
  }

  if (statusText === 'building') {
    return 3;
  }

  if (statusText === 'running') {
    return 4;
  }

  if (statusText === 'stopped') {
    return 5;
  }

  if (statusText === 'no deployments') {
    return 6;
  }

  return 99;
}

export function createProjectServiceStatuses(
  services: readonly ProjectServiceDefinition[] | null | undefined,
  deployments: readonly ApiDeployment[]
): ProjectServiceStatus[] {
  const normalizedServices = normalizeProjectServices(services);
  const deploymentsByServiceName = new Map<string, ApiDeployment>();
  const sortedDeployments = deployments.slice().sort(sortDeploymentsByCreatedAt);

  for (const deployment of sortedDeployments) {
    const serviceName = resolveDeploymentServiceName(deployment);

    if (!deploymentsByServiceName.has(serviceName)) {
      deploymentsByServiceName.set(serviceName, deployment);
    }
  }

  return normalizedServices.map((service) => {
    const latestDeployment = deploymentsByServiceName.get(service.name) ?? null;

    if (!latestDeployment) {
      return {
        service,
        latestDeployment: null,
        statusText: 'no deployments',
        statusVariant: 'secondary',
        cancellationRequested: false
      };
    }

    const cancellationRequested = hasRequestedCancellation(latestDeployment.metadata);

    return {
      service,
      latestDeployment,
      statusText: formatDeploymentStatusText(latestDeployment.status, cancellationRequested),
      statusVariant: deploymentStatusVariant(latestDeployment.status),
      deploymentStatus: latestDeployment.status,
      cancellationRequested
    };
  });
}

export function composeProjectStatus(
  serviceStatuses: readonly ProjectServiceStatus[]
): ComposedProjectStatus {
  const deploymentStatuses = serviceStatuses
    .map((serviceStatus) => serviceStatus.deploymentStatus)
    .filter((status): status is DeploymentStatus => Boolean(status));
  const runningCount = deploymentStatuses.filter((status) => status === 'running').length;
  const stoppedCount = deploymentStatuses.filter((status) => status === 'stopped').length;
  const undeployedCount = serviceStatuses.length - deploymentStatuses.length;

  if (deploymentStatuses.length === 0) {
    return {
      label: 'no deployments',
      variant: 'secondary'
    };
  }

  if (deploymentStatuses.some((status) => status === 'failed')) {
    return {
      label: 'degraded',
      variant: 'destructive'
    };
  }

  if (deploymentStatuses.some((status) => status === 'queued' || status === 'building')) {
    return {
      label: 'deploying',
      variant: 'warning'
    };
  }

  if (runningCount === serviceStatuses.length) {
    return {
      label: 'healthy',
      variant: 'success'
    };
  }

  if (runningCount > 0 && undeployedCount > 0) {
    return {
      label: 'partial',
      variant: 'warning'
    };
  }

  if (runningCount > 0) {
    return {
      label: 'mixed',
      variant: 'info'
    };
  }

  if (stoppedCount === serviceStatuses.length) {
    return {
      label: 'stopped',
      variant: 'secondary'
    };
  }

  return {
    label: undeployedCount > 0 ? 'partial' : 'mixed',
    variant: undeployedCount > 0 ? 'warning' : 'info'
  };
}

export function formatProjectServiceStatusSummary(
  serviceStatuses: readonly ProjectServiceStatus[]
): string {
  if (serviceStatuses.length <= 3) {
    return serviceStatuses
      .map((serviceStatus) => `${serviceStatus.service.name} ${serviceStatus.statusText}`)
      .join(' | ');
  }

  return formatProjectServiceStatusBreakdown(serviceStatuses);
}

export function formatProjectServiceStatusBreakdown(
  serviceStatuses: readonly ProjectServiceStatus[]
): string {
  const counts = new Map<string, number>();

  for (const serviceStatus of serviceStatuses) {
    counts.set(serviceStatus.statusText, (counts.get(serviceStatus.statusText) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([leftStatus], [rightStatus]) => statusPriority(leftStatus) - statusPriority(rightStatus))
    .map(([statusText, count]) => `${count} ${statusText}`)
    .join(' | ');
}
