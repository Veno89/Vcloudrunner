import type { DeploymentStatus } from '@vcloudrunner/shared-types';

export const projects: Array<{
  id: string;
  name: string;
  repo: string;
  domain: string;
  status: string;
  deploymentStatus?: DeploymentStatus;
  cancellationRequested?: boolean;
}> = [
  {
    id: 'p1',
    name: 'landing-api',
    repo: 'https://github.com/example/landing-api',
    domain: 'landing-api.apps.platform.example.com',
    status: 'running',
    deploymentStatus: 'running',
    cancellationRequested: false
  },
  {
    id: 'p2',
    name: 'worker-demo',
    repo: 'https://github.com/example/worker-demo',
    domain: 'worker-demo.apps.platform.example.com',
    status: 'building',
    deploymentStatus: 'building',
    cancellationRequested: false
  }
];

export const deployments = [
  {
    id: 'dpl_001',
    project: 'landing-api',
    status: 'running',
    commitSha: 'c0ffee1',
    createdAt: '2026-03-08T19:00:00Z'
  },
  {
    id: 'dpl_002',
    project: 'worker-demo',
    status: 'building',
    commitSha: 'deadbee',
    createdAt: '2026-03-08T20:00:00Z'
  }
];
