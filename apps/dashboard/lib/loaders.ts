import type { DeploymentStatus } from '@vcloudrunner/shared-types';
import { getPrimaryProjectService } from '@vcloudrunner/shared-types';

import {
  fetchApiHealth,
  fetchProjectsForCurrentUser,
  resolveViewerContext,
  fetchDeploymentsForProject,
  fetchQueueHealth,
  fetchWorkerHealth,
  type ApiProject,
  type ApiDeployment,
} from './api';
import { getDashboardRequestAuth } from './dashboard-session';
import {
  deriveDomain,
  describeDashboardLiveDataFailure,
  describePartialDashboardDeploymentFailure,
  hasRequestedCancellation
} from './helpers';
import {
  type DashboardStatusBadgeVariant,
  composeProjectStatus,
  createProjectServiceStatuses,
  formatProjectServiceStatusSummary
} from './project-service-status';

export interface MappedProject {
  id: string;
  name: string;
  repo: string;
  domain: string;
  serviceSummary: string;
  serviceStatusSummary?: string;
  status: string;
  statusVariant: DashboardStatusBadgeVariant;
}

export interface MappedDeployment {
  id: string;
  project: string;
  projectId: string;
  serviceName?: string | null;
  status: DeploymentStatus;
  cancellationRequested?: boolean;
  commitSha: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  runtimeUrl?: string | null;
}

export interface SortedDeploymentItem {
  deployment: ApiDeployment;
  project: ApiProject;
}

export interface PlatformHealth {
  apiStatus: 'ok' | 'degraded' | 'unavailable';
  queueStatus: 'ok' | 'degraded' | 'unavailable';
  workerStatus: 'ok' | 'stale' | 'unavailable';
  queueCounts: { waiting: number; active: number; completed: number; failed: number };
  workerAgeMs?: number;
  lastRunningDeployAt?: string;
}

export interface DashboardData {
  projects: MappedProject[];
  sortedDeployments: SortedDeploymentItem[];
  deployments: MappedDeployment[];
  health: PlatformHealth;
  usingLiveData: boolean;
  liveDataErrorMessage: string | null;
}

export function createFallbackHealth(): PlatformHealth {
  return {
    apiStatus: 'degraded',
    queueStatus: 'unavailable',
    workerStatus: 'unavailable',
    queueCounts: { waiting: 0, active: 0, completed: 0, failed: 0 },
  };
}

export async function loadPlatformHealth(
  lastRunningDeployAt?: string
): Promise<PlatformHealth> {
  const [apiHealth, queueHealth, workerHealth] = await Promise.all([
    fetchApiHealth(),
    fetchQueueHealth(),
    fetchWorkerHealth(),
  ]);

  const queueCounts = queueHealth.counts
    ? {
        waiting: queueHealth.counts.waiting,
        active: queueHealth.counts.active,
        completed: queueHealth.counts.completed,
        failed: queueHealth.counts.failed,
      }
    : { waiting: 0, active: 0, completed: 0, failed: 0 };

  return {
    apiStatus: apiHealth.status,
    queueStatus: queueHealth.status,
    workerStatus: workerHealth.status,
    queueCounts,
    workerAgeMs: workerHealth.ageMs,
    lastRunningDeployAt,
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const requestAuth = getDashboardRequestAuth();
  const fallback: DashboardData = {
    projects: [],
    sortedDeployments: [],
    deployments: [],
    health: createFallbackHealth(),
    usingLiveData: false,
    liveDataErrorMessage: null,
  };

  const health = await loadPlatformHealth().catch(() => createFallbackHealth());

  const { viewer, error: viewerContextError } = await resolveViewerContext();

  if (!viewer) {
    return {
      ...fallback,
      health,
      liveDataErrorMessage: describeDashboardLiveDataFailure({
        ...(viewerContextError ? { error: viewerContextError } : {}),
        hasDemoUserId: requestAuth.hasDemoUserId,
        hasApiAuthToken: requestAuth.hasBearerToken
      })
    };
  }

  try {
    const apiProjects = await fetchProjectsForCurrentUser();

    const deploymentGroupsResult = await Promise.allSettled(
      apiProjects.map(async (project) => {
        const items = await fetchDeploymentsForProject(project.id);
        return items.map((deployment) => ({ deployment, project }));
      })
    );
    const deploymentGroups = deploymentGroupsResult
      .filter((result): result is PromiseFulfilledResult<SortedDeploymentItem[]> => result.status === 'fulfilled')
      .map((result) => result.value);
    const deploymentFailures = deploymentGroupsResult
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    const liveDataErrorMessage =
      deploymentFailures.length > 0
        ? describePartialDashboardDeploymentFailure({
            error: deploymentFailures[0]?.reason,
            failedProjectCount: deploymentFailures.length,
            totalProjectCount: apiProjects.length,
            hasDemoUserId: Boolean(viewer.userId),
            hasApiAuthToken: requestAuth.hasBearerToken
          })
        : null;

    const sortedDeployments = deploymentGroups
      .flat()
      .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt));
    const deploymentGroupResultsByProjectId = new Map(
      apiProjects.map((project, index) => [project.id, deploymentGroupsResult[index]])
    );

    const projects = apiProjects.map((project) => {
      const publicService = getPrimaryProjectService(project.services);
      const serviceSummary =
        project.services.length === 1
          ? `1 service · public: ${publicService.name}`
          : `${project.services.length} services · public: ${publicService.name}`;

      const projectDeploymentResult = deploymentGroupResultsByProjectId.get(project.id);
      if (!projectDeploymentResult || projectDeploymentResult.status === 'rejected') {
        return {
          id: project.id,
          name: project.name,
          repo: project.gitRepositoryUrl,
          domain: deriveDomain(project),
          serviceSummary,
          status: 'history unavailable',
          statusVariant: 'warning' as const,
        };
      }

      const projectDeployments = projectDeploymentResult.value.map((item) => item.deployment);
      const projectServiceStatuses = createProjectServiceStatuses(
        project.services,
        projectDeployments
      );
      const composedProjectStatus = composeProjectStatus(projectServiceStatuses);

      return {
        id: project.id,
        name: project.name,
        repo: project.gitRepositoryUrl,
        domain: deriveDomain(project),
        serviceSummary,
        serviceStatusSummary: formatProjectServiceStatusSummary(projectServiceStatuses),
        status: composedProjectStatus.label,
        statusVariant: composedProjectStatus.variant,
      };
    });

    const deployments = sortedDeployments.slice(0, 10).map(({ deployment, project }) => ({
      id: deployment.id,
      project: project.name,
      projectId: project.id,
      serviceName: deployment.serviceName ?? null,
      status: deployment.status,
      cancellationRequested: hasRequestedCancellation(deployment.metadata),
      commitSha: deployment.commitSha ?? 'unknown',
      createdAt: new Date(deployment.createdAt).toISOString(),
      startedAt: deployment.startedAt,
      finishedAt: deployment.finishedAt,
      runtimeUrl: deployment.runtimeUrl,
    }));

    const lastRunningDeployment = sortedDeployments.find(
      (item) => item.deployment.status === 'running'
    );

    const nextHealth = {
      ...health,
      lastRunningDeployAt: lastRunningDeployment?.deployment.createdAt,
    };

    return {
      projects,
      sortedDeployments,
      deployments,
      health: nextHealth,
      usingLiveData: true,
      liveDataErrorMessage,
    };
  } catch (error) {
    return {
      ...fallback,
      health,
        liveDataErrorMessage: describeDashboardLiveDataFailure({
          error,
          hasDemoUserId: Boolean(viewer.userId),
          hasApiAuthToken: requestAuth.hasBearerToken
        }),
    };
  }
}
