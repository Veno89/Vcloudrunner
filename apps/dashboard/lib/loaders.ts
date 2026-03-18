import type { DeploymentStatus } from '@vcloudrunner/shared-types';

import {
  apiAuthToken,
  demoUserId,
  fetchApiHealth,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchQueueHealth,
  fetchWorkerHealth,
  type ApiProject,
  type ApiDeployment,
} from './api';
import { deriveDomain, describeDashboardLiveDataFailure } from './helpers';

export interface MappedProject {
  id: string;
  name: string;
  repo: string;
  domain: string;
  status: string;
}

export interface MappedDeployment {
  id: string;
  project: string;
  projectId: string;
  status: DeploymentStatus;
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
  lastSuccessfulDeployAt?: string;
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
  lastSuccessfulDeployAt?: string
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
    lastSuccessfulDeployAt,
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const fallback: DashboardData = {
    projects: [],
    sortedDeployments: [],
    deployments: [],
    health: createFallbackHealth(),
    usingLiveData: false,
    liveDataErrorMessage: null,
  };

  const health = await loadPlatformHealth().catch(() => createFallbackHealth());

  if (!demoUserId) {
    return {
      ...fallback,
      health,
      liveDataErrorMessage: describeDashboardLiveDataFailure({
        hasDemoUserId: false,
        hasApiAuthToken: Boolean(apiAuthToken)
      })
    };
  }

  try {
    const apiProjects = await fetchProjectsForDemoUser();

    const deploymentGroups = await Promise.all(
      apiProjects.map(async (project) => {
        const items = await fetchDeploymentsForProject(project.id);
        return items.map((deployment) => ({ deployment, project }));
      })
    );

    const sortedDeployments = deploymentGroups
      .flat()
      .sort((a, b) => Date.parse(b.deployment.createdAt) - Date.parse(a.deployment.createdAt));

    const projects = apiProjects.map((project) => ({
      id: project.id,
      name: project.name,
      repo: project.gitRepositoryUrl,
      domain: deriveDomain(project),
      status: 'active',
    }));

    const deployments = sortedDeployments.slice(0, 10).map(({ deployment, project }) => ({
      id: deployment.id,
      project: project.name,
      projectId: project.id,
      status: deployment.status,
      commitSha: deployment.commitSha ?? 'unknown',
      createdAt: new Date(deployment.createdAt).toISOString(),
      startedAt: deployment.startedAt,
      finishedAt: deployment.finishedAt,
      runtimeUrl: deployment.runtimeUrl,
    }));

    const lastSuccessful = sortedDeployments.find(
      (item) => item.deployment.status === 'running'
    );

    const nextHealth = {
      ...health,
      lastSuccessfulDeployAt: lastSuccessful?.deployment.createdAt,
    };

    return {
      projects,
      sortedDeployments,
      deployments,
      health: nextHealth,
      usingLiveData: true,
      liveDataErrorMessage: null,
    };
  } catch (error) {
    return {
      ...fallback,
      health,
      liveDataErrorMessage: describeDashboardLiveDataFailure({
        error,
        hasDemoUserId: true,
        hasApiAuthToken: Boolean(apiAuthToken)
      }),
    };
  }
}
