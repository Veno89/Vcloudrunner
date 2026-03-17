import type { DeploymentStatus } from '@vcloudrunner/shared-types';

import {
  demoUserId,
  fetchProjectsForDemoUser,
  fetchDeploymentsForProject,
  fetchQueueHealth,
  fetchWorkerHealth,
  type ApiProject,
  type ApiDeployment,
} from './api';
import { deriveDomain } from './helpers';

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

export async function loadDashboardData(): Promise<DashboardData> {
  const fallback: DashboardData = {
    projects: [],
    sortedDeployments: [],
    deployments: [],
    health: {
      apiStatus: 'degraded',
      queueStatus: 'unavailable',
      workerStatus: 'unavailable',
      queueCounts: { waiting: 0, active: 0, completed: 0, failed: 0 },
    },
    usingLiveData: false,
    liveDataErrorMessage: null,
  };

  if (!demoUserId) {
    return fallback;
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

    const [queueHealth, workerHealth] = await Promise.all([
      fetchQueueHealth(),
      fetchWorkerHealth(),
    ]);

    const apiStatus =
      queueHealth.status === 'unavailable' && workerHealth.status === 'unavailable'
        ? 'degraded'
        : 'ok';

    const queueCounts = queueHealth.counts
      ? {
          waiting: queueHealth.counts.waiting,
          active: queueHealth.counts.active,
          completed: queueHealth.counts.completed,
          failed: queueHealth.counts.failed,
        }
      : { waiting: 0, active: 0, completed: 0, failed: 0 };

    const lastSuccessful = sortedDeployments.find(
      (item) => item.deployment.status === 'running'
    );

    return {
      projects,
      sortedDeployments,
      deployments,
      health: {
        apiStatus,
        queueStatus: queueHealth.status,
        workerStatus: workerHealth.status,
        queueCounts,
        workerAgeMs: workerHealth.ageMs,
        lastSuccessfulDeployAt: lastSuccessful?.deployment.createdAt,
      },
      usingLiveData: true,
      liveDataErrorMessage: null,
    };
  } catch (error) {
    return {
      ...fallback,
      liveDataErrorMessage:
        error instanceof Error ? error.message : 'Failed to fetch live API data.',
    };
  }
}
