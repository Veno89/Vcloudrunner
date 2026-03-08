export const projects = [
  {
    id: 'p1',
    name: 'landing-api',
    repo: 'https://github.com/example/landing-api',
    domain: 'landing-api.apps.platform.example.com',
    status: 'running'
  },
  {
    id: 'p2',
    name: 'worker-demo',
    repo: 'https://github.com/example/worker-demo',
    domain: 'worker-demo.apps.platform.example.com',
    status: 'building'
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
