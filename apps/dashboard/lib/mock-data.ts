export const projects: Array<{
  id: string;
  name: string;
  repo: string;
  domain: string;
  routeStatusSummary?: string;
  serviceSummary: string;
  serviceStatusSummary?: string;
  status: string;
  statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
}> = [
  {
    id: 'p1',
    name: 'landing-api',
    repo: 'https://github.com/example/landing-api',
    domain: 'landing-api.apps.platform.example.com',
    routeStatusSummary: 'route active',
    serviceSummary: '1 service · public: app',
    serviceStatusSummary: 'app running',
    status: 'healthy',
    statusVariant: 'success'
  },
  {
    id: 'p2',
    name: 'worker-demo',
    repo: 'https://github.com/example/worker-demo',
    domain: 'worker-demo.apps.platform.example.com',
    routeStatusSummary: 'route pending',
    serviceSummary: '2 services · public: frontend',
    serviceStatusSummary: 'frontend building | worker no deployments',
    status: 'deploying',
    statusVariant: 'warning'
  }
];

export const deployments = [
  {
    id: 'dpl_001',
    project: 'landing-api',
    serviceName: 'app',
    status: 'running',
    commitSha: 'c0ffee1',
    createdAt: '2026-03-08T19:00:00Z'
  },
  {
    id: 'dpl_002',
    project: 'worker-demo',
    serviceName: 'frontend',
    status: 'building',
    commitSha: 'deadbee',
    createdAt: '2026-03-08T20:00:00Z'
  }
];
