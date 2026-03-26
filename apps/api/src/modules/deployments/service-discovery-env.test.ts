import assert from 'node:assert/strict';
import test from 'node:test';

import { createProjectServiceDiscoveryEnv } from './service-discovery-env.js';

test('createProjectServiceDiscoveryEnv exposes selected-service and per-service discovery variables', () => {
  const env = createProjectServiceDiscoveryEnv({
    projectSlug: 'demo-project',
    services: [
      {
        name: 'frontend',
        kind: 'web',
        sourceRoot: 'apps/frontend',
        exposure: 'public',
        runtime: {
          containerPort: 8080
        }
      },
      {
        name: 'worker',
        kind: 'worker',
        sourceRoot: 'apps/worker',
        exposure: 'internal'
      }
    ],
    selectedService: {
      name: 'worker',
      kind: 'worker',
      sourceRoot: 'apps/worker',
      exposure: 'internal'
    },
    defaultContainerPort: 3000
  });

  assert.equal(env.VCLOUDRUNNER_PROJECT_SLUG, 'demo-project');
  assert.equal(env.VCLOUDRUNNER_PROJECT_SERVICE_NAMES, 'frontend,worker');
  assert.equal(env.VCLOUDRUNNER_SERVICE_NAME, 'worker');
  assert.equal(env.VCLOUDRUNNER_SERVICE_HOST, 'svc-demo-project-worker');
  assert.equal(env.VCLOUDRUNNER_SERVICE_PORT, '3000');
  assert.equal(env.VCLOUDRUNNER_SERVICE_ADDRESS, 'svc-demo-project-worker:3000');
  assert.equal(env.VCLOUDRUNNER_SERVICE_FRONTEND_HOST, 'svc-demo-project-frontend');
  assert.equal(env.VCLOUDRUNNER_SERVICE_FRONTEND_PORT, '8080');
  assert.equal(env.VCLOUDRUNNER_SERVICE_FRONTEND_ADDRESS, 'svc-demo-project-frontend:8080');
});

test('createProjectServiceDiscoveryEnv keeps internal hostnames within docker dns limits', () => {
  const env = createProjectServiceDiscoveryEnv({
    projectSlug: 'project-with-an-extremely-long-slug-that-needs-truncation-for-service-discovery',
    services: [
      {
        name: 'service-with-an-extremely-long-name-that-needs-truncation',
        kind: 'web',
        sourceRoot: '.',
        exposure: 'public'
      }
    ],
    selectedService: {
      name: 'service-with-an-extremely-long-name-that-needs-truncation',
      kind: 'web',
      sourceRoot: '.',
      exposure: 'public'
    },
    defaultContainerPort: 3000
  });

  assert.ok(env.VCLOUDRUNNER_SERVICE_HOST.length <= 63);
  assert.match(env.VCLOUDRUNNER_SERVICE_HOST, /^svc-/);
});
