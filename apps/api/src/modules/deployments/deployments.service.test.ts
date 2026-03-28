import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectServiceInternalHostname,
  createDefaultProjectServices
} from '@vcloudrunner/shared-types';

import {
  DeploymentAlreadyActiveError,
  DeploymentCancellationNotAllowedError,
  DeploymentNotFoundError,
  DeploymentQueueUnavailableError,
  InvalidProjectServiceError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

const { DeploymentsService } = await import('./deployments.service.js');

const project = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'demo-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main',
  services: createDefaultProjectServices()
};

const createdDeployment = {
  id: '11111111-1111-1111-1111-111111111111'
};

function buildService(overrides?: {
  projectResult?: typeof project | null;
  domainsResult?: Array<{ host: string }>;
  createResult?: { id: string } | null;
  createError?: unknown;
  envVarsResult?: Array<{ key: string; encryptedValue: string }>;
  envVarsError?: Error;
  decryptError?: Error;
  enqueueError?: Error;
  markFailedError?: Error;
  onMarkFailed?: (deploymentId: string, message: string) => void;
  onEnqueue?: (payload: Record<string, unknown>) => void;
  onCreateDeployment?: (input: Record<string, unknown>) => void;
  deploymentByIdResult?: { id: string; status: 'queued' | 'building' | 'running' | 'failed' | 'stopped'; metadata?: unknown } | null;
  cancelQueuedResult?: boolean;
  cancelQueuedError?: Error;
  onMarkStopped?: (deploymentId: string) => void;
  markStoppedError?: Error;
  onAppendLog?: (input: { deploymentId: string; level: string; message: string }) => void;
  appendLogError?: Error;
  onMarkCancellationRequested?: (input: { deploymentId: string; metadata: Record<string, unknown>; requestedByCorrelationId: string }) => void;
}) {
  const queue = {
    enqueue: async (payload: Record<string, unknown>) => {
      if (overrides?.enqueueError) {
        throw overrides.enqueueError;
      }

      overrides?.onEnqueue?.(payload);
      return { id: 'job-1' };
    },
    cancelQueuedDeployment: async () => {
      if (overrides?.cancelQueuedError) {
        throw overrides.cancelQueuedError;
      }

      return overrides?.cancelQueuedResult ?? false;
    }
  };

  return new DeploymentsService({} as never, queue as never, {
    projectsRepository: {
      findById: async () => Object.prototype.hasOwnProperty.call(overrides ?? {}, 'projectResult')
        ? (overrides?.projectResult ?? null)
        : project
      ,
      listDomains: async () => overrides?.domainsResult ?? []
    } as never,
    deploymentsRepository: {
      createIfNoActiveDeployment: async (input: Record<string, unknown>) => {
        if (overrides?.createError) {
          throw overrides.createError;
        }

        overrides?.onCreateDeployment?.(input);

        if (Object.prototype.hasOwnProperty.call(overrides ?? {}, 'createResult')) {
          return overrides?.createResult ?? null;
        }

        return createdDeployment;
      },
      markFailed: async (deploymentId: string, message: string) => {
        if (overrides?.onMarkFailed) {
          overrides.onMarkFailed(deploymentId, message);
        }

        if (overrides?.markFailedError) {
          throw overrides.markFailedError;
        }
      },
      findById: async () => Object.prototype.hasOwnProperty.call(overrides ?? {}, 'deploymentByIdResult')
        ? (overrides?.deploymentByIdResult ?? null)
        : null,
      markCancellationRequested: async (input: { deploymentId: string; metadata: Record<string, unknown>; requestedByCorrelationId: string }) => {
        overrides?.onMarkCancellationRequested?.(input);
      },
      markStopped: async (deploymentId: string) => {
        overrides?.onMarkStopped?.(deploymentId);

        if (overrides?.markStoppedError) {
          throw overrides.markStoppedError;
        }
      },
      appendLog: async (input: { deploymentId: string; level: string; message: string }) => {
        overrides?.onAppendLog?.(input);

        if (overrides?.appendLogError) {
          throw overrides.appendLogError;
        }
      }
    } as never,
    environmentRepository: {
      listByProject: async () => {
        if (overrides?.envVarsError) {
          throw overrides.envVarsError;
        }

        return overrides?.envVarsResult ?? [];
      }
    } as never,
    cryptoService: {
      decrypt: (value: string) => {
        if (overrides?.decryptError) {
          throw overrides.decryptError;
        }

        return value;
      }
    } as never
  });
}

test('createDeployment throws ProjectNotFoundError when project does not exist', async () => {
  const service = buildService({ projectResult: null });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-1'
    }),
    ProjectNotFoundError
  );
});

test('createDeployment throws DeploymentAlreadyActiveError when insert is skipped', async () => {
  const service = buildService({ createResult: null });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-2'
    }),
    DeploymentAlreadyActiveError
  );
});

test('createDeployment maps unique constraint violations to DeploymentAlreadyActiveError', async () => {
  const service = buildService({
    createError: { code: '23505', constraint: 'deployments_project_service_single_active_idx', table: 'deployments' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-4'
    }),
    DeploymentAlreadyActiveError
  );
});

test('createDeployment maps index violation without table metadata to DeploymentAlreadyActiveError', async () => {
  const service = buildService({
    createError: { code: '23505', constraint: 'deployments_project_service_single_active_idx' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-4b'
    }),
    DeploymentAlreadyActiveError
  );
});

test('createDeployment rethrows unrelated unique violations', async () => {
  const service = buildService({
    createError: { code: '23505', constraint: 'some_other_unique_idx', table: 'deployments' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5'
    }),
    (error: unknown) => {
      const e = error as { code?: unknown; constraint?: unknown };
      return e.code === '23505' && e.constraint === 'some_other_unique_idx';
    }
  );
});

test('createDeployment rethrows index violation for non-deployments table', async () => {
  const service = buildService({
    createError: { code: '23505', constraint: 'deployments_project_service_single_active_idx', table: 'projects' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5b'
    }),
    (error: unknown) => {
      const e = error as { code?: unknown; constraint?: unknown; table?: unknown };
      return e.code === '23505' && e.constraint === 'deployments_project_service_single_active_idx' && e.table === 'projects';
    }
  );
});


test('createDeployment maps project foreign-key violations to ProjectNotFoundError', async () => {
  const service = buildService({
    createError: { code: '23503', constraint: 'deployments_project_id_projects_id_fk', table: 'deployments' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5c'
    }),
    ProjectNotFoundError
  );
});


test('createDeployment maps project FK violation without table metadata to ProjectNotFoundError', async () => {
  const service = buildService({
    createError: { code: '23503', constraint: 'deployments_project_id_projects_id_fk' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5d'
    }),
    ProjectNotFoundError
  );
});

test('createDeployment rethrows unrelated foreign-key violations', async () => {
  const service = buildService({
    createError: { code: '23503', constraint: 'some_other_fk', table: 'deployments' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5e'
    }),
    (error: unknown) => {
      const e = error as { code?: unknown; constraint?: unknown };
      return e.code === '23503' && e.constraint === 'some_other_fk';
    }
  );
});

test('createDeployment rethrows project FK violation for non-deployments table', async () => {
  const service = buildService({
    createError: { code: '23503', constraint: 'deployments_project_id_projects_id_fk', table: 'projects' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5f'
    }),
    (error: unknown) => {
      const e = error as { code?: unknown; constraint?: unknown; table?: unknown };
      return e.code === '23503' && e.constraint === 'deployments_project_id_projects_id_fk' && e.table === 'projects';
    }
  );
});

test('createDeployment still throws DeploymentQueueUnavailableError when markFailed best-effort update fails', async () => {
  const service = buildService({
    enqueueError: new Error('redis down'),
    markFailedError: new Error('database unavailable')
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-6'
    }),
    DeploymentQueueUnavailableError
  );
});

test('createDeployment marks failed with diagnostics and throws DeploymentQueueUnavailableError when enqueue fails', async () => {
  const markFailedCalls: Array<{ deploymentId: string; message: string }> = [];

  const service = buildService({
    enqueueError: new Error('redis down'),
    onMarkFailed: (deploymentId, message) => {
      markFailedCalls.push({ deploymentId, message });
    }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-3'
    }),
    DeploymentQueueUnavailableError
  );

  assert.equal(markFailedCalls.length, 1);
  assert.equal(markFailedCalls[0]?.deploymentId, createdDeployment.id);
  assert.match(markFailedCalls[0]?.message ?? '', /^DEPLOYMENT_QUEUE_ENQUEUE_FAILED:/);
});

test('createDeployment marks failed and rethrows the original error when env decryption fails after the deployment row is created', async () => {
  const markFailedCalls: Array<{ deploymentId: string; message: string }> = [];
  const decryptError = new Error('INVALID_CIPHERTEXT_FORMAT');

  const service = buildService({
    envVarsResult: [{ key: 'API_KEY', encryptedValue: 'bad-ciphertext' }],
    decryptError,
    onMarkFailed: (deploymentId, message) => {
      markFailedCalls.push({ deploymentId, message });
    }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-3b'
    }),
    decryptError
  );

  assert.equal(markFailedCalls.length, 1);
  assert.equal(markFailedCalls[0]?.deploymentId, createdDeployment.id);
  assert.match(markFailedCalls[0]?.message ?? '', /^DEPLOYMENT_ENV_RESOLUTION_FAILED:/);
});

test('createDeployment still rethrows the original env error when markFailed best-effort update fails', async () => {
  const decryptError = new Error('INVALID_CIPHERTEXT_FORMAT');

  const service = buildService({
    envVarsResult: [{ key: 'API_KEY', encryptedValue: 'bad-ciphertext' }],
    decryptError,
    markFailedError: new Error('database unavailable')
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-3c'
    }),
    decryptError
  );
});

test('createDeployment uses the primary public service runtime defaults and queue metadata', async () => {
  let createInput: Record<string, unknown> | null = null;
  let enqueuePayload: Record<string, unknown> | null = null;

  const service = buildService({
    projectResult: {
      ...project,
      services: [
        {
          name: 'worker',
          kind: 'worker',
          sourceRoot: 'apps/worker',
          exposure: 'internal',
          runtime: {
            memoryMb: 768
          }
        },
        {
          name: 'frontend',
          kind: 'web',
          sourceRoot: 'apps/frontend',
          exposure: 'public',
          runtime: {
            containerPort: 8080,
            memoryMb: 1024
          }
        }
      ]
    },
    onCreateDeployment: (input) => {
      createInput = input;
    },
    onEnqueue: (payload) => {
      enqueuePayload = payload;
    }
  });

  await service.createDeployment({
    projectId: project.id,
    correlationId: 'corr-services-1'
  });

  assert.ok(createInput);
  assert.equal((createInput as { serviceName: string }).serviceName, 'frontend');
  assert.deepEqual((createInput as { metadata: unknown }).metadata, {
    runtime: {
      containerPort: 8080,
      memoryMb: 1024,
      cpuMillicores: 500
    },
    service: {
      name: 'frontend',
      kind: 'web',
      sourceRoot: 'apps/frontend',
      exposure: 'public'
    },
    services: [
      {
        name: 'worker',
        kind: 'worker',
        sourceRoot: 'apps/worker',
        exposure: 'internal',
        runtime: {
          memoryMb: 768
        }
      },
      {
        name: 'frontend',
        kind: 'web',
        sourceRoot: 'apps/frontend',
        exposure: 'public',
        runtime: {
          containerPort: 8080,
          memoryMb: 1024
        }
      }
    ]
  });

  assert.ok(enqueuePayload);
  const queuedFrontendPayload = enqueuePayload as Record<string, unknown> & {
    env: Record<string, string>;
    runtime: unknown;
  };
  assert.equal(queuedFrontendPayload.deploymentId, createdDeployment.id);
  assert.equal(queuedFrontendPayload.projectId, project.id);
  assert.equal(queuedFrontendPayload.projectSlug, project.slug);
  assert.equal(queuedFrontendPayload.correlationId, 'corr-services-1');
  assert.equal(queuedFrontendPayload.gitRepositoryUrl, project.gitRepositoryUrl);
  assert.equal(queuedFrontendPayload.branch, project.defaultBranch);
  assert.equal(queuedFrontendPayload.commitSha, undefined);
  assert.equal(queuedFrontendPayload.serviceName, 'frontend');
  assert.equal(queuedFrontendPayload.serviceKind, 'web');
  assert.equal(queuedFrontendPayload.serviceSourceRoot, 'apps/frontend');
  assert.equal(queuedFrontendPayload.serviceExposure, 'public');
  assert.deepEqual(queuedFrontendPayload.runtime, {
    containerPort: 8080,
    memoryMb: 1024,
    cpuMillicores: 500
  });
  assert.deepEqual(queuedFrontendPayload.publicRouteHosts, [
    'demo-project.platform.local'
  ]);
  assert.deepEqual(queuedFrontendPayload.env, {
    VCLOUDRUNNER_PROJECT_SLUG: 'demo-project',
    VCLOUDRUNNER_PROJECT_SERVICE_NAMES: 'worker,frontend',
    VCLOUDRUNNER_SERVICE_NAME: 'frontend',
    VCLOUDRUNNER_SERVICE_KIND: 'web',
    VCLOUDRUNNER_SERVICE_EXPOSURE: 'public',
    VCLOUDRUNNER_SERVICE_SOURCE_ROOT: 'apps/frontend',
    VCLOUDRUNNER_SERVICE_HOST: buildProjectServiceInternalHostname('demo-project', 'frontend'),
    VCLOUDRUNNER_SERVICE_PORT: '8080',
    VCLOUDRUNNER_SERVICE_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'frontend')}:8080`,
    VCLOUDRUNNER_SERVICE_WORKER_NAME: 'worker',
    VCLOUDRUNNER_SERVICE_WORKER_KIND: 'worker',
    VCLOUDRUNNER_SERVICE_WORKER_EXPOSURE: 'internal',
    VCLOUDRUNNER_SERVICE_WORKER_SOURCE_ROOT: 'apps/worker',
    VCLOUDRUNNER_SERVICE_WORKER_HOST: buildProjectServiceInternalHostname('demo-project', 'worker'),
    VCLOUDRUNNER_SERVICE_WORKER_PORT: '3000',
    VCLOUDRUNNER_SERVICE_WORKER_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'worker')}:3000`,
    VCLOUDRUNNER_SERVICE_FRONTEND_NAME: 'frontend',
    VCLOUDRUNNER_SERVICE_FRONTEND_KIND: 'web',
    VCLOUDRUNNER_SERVICE_FRONTEND_EXPOSURE: 'public',
    VCLOUDRUNNER_SERVICE_FRONTEND_SOURCE_ROOT: 'apps/frontend',
    VCLOUDRUNNER_SERVICE_FRONTEND_HOST: buildProjectServiceInternalHostname('demo-project', 'frontend'),
    VCLOUDRUNNER_SERVICE_FRONTEND_PORT: '8080',
    VCLOUDRUNNER_SERVICE_FRONTEND_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'frontend')}:8080`
  });
});

test('createDeployment uses an explicitly requested named service and its runtime defaults', async () => {
  let createInput: Record<string, unknown> | null = null;
  let enqueuePayload: Record<string, unknown> | null = null;

  const service = buildService({
    projectResult: {
      ...project,
      services: [
        {
          name: 'frontend',
          kind: 'web',
          sourceRoot: 'apps/frontend',
          exposure: 'public',
          runtime: {
            containerPort: 8080,
            memoryMb: 1024
          }
        },
        {
          name: 'worker',
          kind: 'worker',
          sourceRoot: 'apps/worker',
          exposure: 'internal',
          runtime: {
            memoryMb: 768,
            cpuMillicores: 700
          }
        }
      ]
    },
    envVarsResult: [
      {
        key: 'DATABASE_URL',
        encryptedValue: 'postgres://internal-db'
      }
    ],
    onCreateDeployment: (input) => {
      createInput = input;
    },
    onEnqueue: (payload) => {
      enqueuePayload = payload;
    }
  });

  await service.createDeployment({
    projectId: project.id,
    correlationId: 'corr-services-explicit-1',
    serviceName: 'worker'
  });

  assert.ok(createInput);
  assert.equal((createInput as { serviceName: string }).serviceName, 'worker');
  assert.deepEqual((createInput as { metadata: unknown }).metadata, {
    runtime: {
      containerPort: 3000,
      memoryMb: 768,
      cpuMillicores: 700
    },
    service: {
      name: 'worker',
      kind: 'worker',
      sourceRoot: 'apps/worker',
      exposure: 'internal'
    },
    services: [
      {
        name: 'frontend',
        kind: 'web',
        sourceRoot: 'apps/frontend',
        exposure: 'public',
        runtime: {
          containerPort: 8080,
          memoryMb: 1024
        }
      },
      {
        name: 'worker',
        kind: 'worker',
        sourceRoot: 'apps/worker',
        exposure: 'internal',
        runtime: {
          memoryMb: 768,
          cpuMillicores: 700
        }
      }
    ]
  });

  assert.ok(enqueuePayload);
  const queuedWorkerPayload = enqueuePayload as Record<string, unknown> & {
    env: Record<string, string>;
    runtime: unknown;
  };
  assert.equal(queuedWorkerPayload.deploymentId, createdDeployment.id);
  assert.equal(queuedWorkerPayload.projectId, project.id);
  assert.equal(queuedWorkerPayload.projectSlug, project.slug);
  assert.equal(queuedWorkerPayload.correlationId, 'corr-services-explicit-1');
  assert.equal(queuedWorkerPayload.gitRepositoryUrl, project.gitRepositoryUrl);
  assert.equal(queuedWorkerPayload.branch, project.defaultBranch);
  assert.equal(queuedWorkerPayload.commitSha, undefined);
  assert.equal(queuedWorkerPayload.serviceName, 'worker');
  assert.equal(queuedWorkerPayload.serviceKind, 'worker');
  assert.equal(queuedWorkerPayload.serviceSourceRoot, 'apps/worker');
  assert.equal(queuedWorkerPayload.serviceExposure, 'internal');
  assert.deepEqual(queuedWorkerPayload.runtime, {
    containerPort: 3000,
    memoryMb: 768,
    cpuMillicores: 700
  });
  assert.deepEqual(queuedWorkerPayload.publicRouteHosts, []);
  assert.deepEqual(queuedWorkerPayload.env, {
    DATABASE_URL: 'postgres://internal-db',
    VCLOUDRUNNER_PROJECT_SLUG: 'demo-project',
    VCLOUDRUNNER_PROJECT_SERVICE_NAMES: 'frontend,worker',
    VCLOUDRUNNER_SERVICE_NAME: 'worker',
    VCLOUDRUNNER_SERVICE_KIND: 'worker',
    VCLOUDRUNNER_SERVICE_EXPOSURE: 'internal',
    VCLOUDRUNNER_SERVICE_SOURCE_ROOT: 'apps/worker',
    VCLOUDRUNNER_SERVICE_HOST: buildProjectServiceInternalHostname('demo-project', 'worker'),
    VCLOUDRUNNER_SERVICE_PORT: '3000',
    VCLOUDRUNNER_SERVICE_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'worker')}:3000`,
    VCLOUDRUNNER_SERVICE_FRONTEND_NAME: 'frontend',
    VCLOUDRUNNER_SERVICE_FRONTEND_KIND: 'web',
    VCLOUDRUNNER_SERVICE_FRONTEND_EXPOSURE: 'public',
    VCLOUDRUNNER_SERVICE_FRONTEND_SOURCE_ROOT: 'apps/frontend',
    VCLOUDRUNNER_SERVICE_FRONTEND_HOST: buildProjectServiceInternalHostname('demo-project', 'frontend'),
    VCLOUDRUNNER_SERVICE_FRONTEND_PORT: '8080',
    VCLOUDRUNNER_SERVICE_FRONTEND_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'frontend')}:8080`,
    VCLOUDRUNNER_SERVICE_WORKER_NAME: 'worker',
    VCLOUDRUNNER_SERVICE_WORKER_KIND: 'worker',
    VCLOUDRUNNER_SERVICE_WORKER_EXPOSURE: 'internal',
    VCLOUDRUNNER_SERVICE_WORKER_SOURCE_ROOT: 'apps/worker',
    VCLOUDRUNNER_SERVICE_WORKER_HOST: buildProjectServiceInternalHostname('demo-project', 'worker'),
    VCLOUDRUNNER_SERVICE_WORKER_PORT: '3000',
    VCLOUDRUNNER_SERVICE_WORKER_ADDRESS: `${buildProjectServiceInternalHostname('demo-project', 'worker')}:3000`
  });
});

test('createDeployment throws InvalidProjectServiceError when the requested service does not exist', async () => {
  const service = buildService();

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-services-invalid-1',
      serviceName: 'missing-service'
    }),
    InvalidProjectServiceError
  );
});

test('createDeployment lets explicit deployment runtime override the primary service defaults', async () => {
  let enqueuePayload: Record<string, unknown> | null = null;

  const service = buildService({
    projectResult: {
      ...project,
      services: [
        {
          name: 'frontend',
          kind: 'web',
          sourceRoot: 'apps/frontend',
          exposure: 'public',
          runtime: {
            containerPort: 8080,
            memoryMb: 1024,
            cpuMillicores: 750
          }
        }
      ]
    },
    onEnqueue: (payload) => {
      enqueuePayload = payload;
    }
  });

  await service.createDeployment({
    projectId: project.id,
    correlationId: 'corr-services-2',
    runtime: {
      containerPort: 3001,
      cpuMillicores: 900
    }
  });

  assert.ok(enqueuePayload);
  assert.deepEqual((enqueuePayload as { runtime: unknown }).runtime, {
    containerPort: 3001,
    memoryMb: 1024,
    cpuMillicores: 900
  });
});

test('createDeployment includes claimed custom domains for the public service route snapshot', async () => {
  let enqueuePayload: Record<string, unknown> | null = null;

  const service = buildService({
    domainsResult: [
      { host: 'demo-project.platform.local' },
      { host: 'app.example.com' },
      { host: 'www.example.com' }
    ],
    onEnqueue: (payload) => {
      enqueuePayload = payload;
    }
  });

  await service.createDeployment({
    projectId: project.id,
    correlationId: 'corr-routes-1'
  });

  assert.ok(enqueuePayload);
  assert.deepEqual((enqueuePayload as { publicRouteHosts: string[] }).publicRouteHosts, [
    'demo-project.platform.local',
    'app.example.com',
    'www.example.com'
  ]);
});


test('cancelDeployment throws DeploymentNotFoundError when deployment does not exist', async () => {
  const service = buildService({ deploymentByIdResult: null });

  await assert.rejects(
    service.cancelDeployment({
      projectId: project.id,
      deploymentId: 'dep-missing',
      correlationId: 'corr-cancel-1'
    }),
    DeploymentNotFoundError
  );
});

test('cancelDeployment returns requested when queue cancellation throws for queued deployment', async () => {
  const cancellationLogs: Array<{ deploymentId: string; level: string; message: string }> = [];

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-queued',
      status: 'queued',
      metadata: {}
    },
    cancelQueuedError: new Error('queue unavailable'),
    onAppendLog: (input) => cancellationLogs.push(input)
  });

  const result = await service.cancelDeployment({
    projectId: project.id,
    deploymentId: 'dep-queued',
    correlationId: 'corr-cancel-2'
  });

  assert.deepEqual(result, {
    deploymentId: 'dep-queued',
    status: 'queued',
    cancellation: 'requested'
  });
  assert.equal(cancellationLogs.length, 1);
  assert.match(cancellationLogs[0]?.message ?? '', /cancellation requested; worker will stop before activation/i);
});

test('cancelDeployment marks stopped when queued job is removed', async () => {
  const markStoppedCalls: string[] = [];
  const appendLogCalls: Array<{ deploymentId: string; level: string; message: string }> = [];

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-queued-stop',
      status: 'queued',
      metadata: { previous: 'value' }
    },
    cancelQueuedResult: true,
    onMarkStopped: (deploymentId) => markStoppedCalls.push(deploymentId),
    onAppendLog: (input) => appendLogCalls.push(input)
  });

  const result = await service.cancelDeployment({
    projectId: project.id,
    deploymentId: 'dep-queued-stop',
    correlationId: 'corr-cancel-3'
  });

  assert.deepEqual(result, {
    deploymentId: 'dep-queued-stop',
    status: 'stopped',
    cancellation: 'completed'
  });
  assert.deepEqual(markStoppedCalls, ['dep-queued-stop']);
  assert.equal(appendLogCalls.length, 1);
  assert.match(appendLogCalls[0]?.message ?? '', /cancelled before execution/i);
});

test('cancelDeployment still returns completed when queued cancellation log write fails after stop state is saved', async () => {
  const markStoppedCalls: string[] = [];

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-queued-stop-log-fail',
      status: 'queued',
      metadata: {}
    },
    cancelQueuedResult: true,
    appendLogError: new Error('log insert failed'),
    onMarkStopped: (deploymentId) => markStoppedCalls.push(deploymentId)
  });

  const result = await service.cancelDeployment({
    projectId: project.id,
    deploymentId: 'dep-queued-stop-log-fail',
    correlationId: 'corr-cancel-3b'
  });

  assert.deepEqual(result, {
    deploymentId: 'dep-queued-stop-log-fail',
    status: 'stopped',
    cancellation: 'completed'
  });
  assert.deepEqual(markStoppedCalls, ['dep-queued-stop-log-fail']);
});

test('cancelDeployment marks failed and rethrows the original error when stop persistence fails after queue removal', async () => {
  const markFailedCalls: Array<{ deploymentId: string; message: string }> = [];
  const markStoppedError = new Error('database unavailable');

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-queued-stop-persist-fail',
      status: 'queued',
      metadata: {}
    },
    cancelQueuedResult: true,
    markStoppedError,
    onMarkFailed: (deploymentId, message) => {
      markFailedCalls.push({ deploymentId, message });
    }
  });

  await assert.rejects(
    service.cancelDeployment({
      projectId: project.id,
      deploymentId: 'dep-queued-stop-persist-fail',
      correlationId: 'corr-cancel-3c'
    }),
    markStoppedError
  );

  assert.equal(markFailedCalls.length, 1);
  assert.equal(markFailedCalls[0]?.deploymentId, 'dep-queued-stop-persist-fail');
  assert.match(markFailedCalls[0]?.message ?? '', /^DEPLOYMENT_CANCEL_FINALIZATION_FAILED:/);
});

test('cancelDeployment still rethrows the original stop persistence error when failed-state fallback also fails', async () => {
  const markStoppedError = new Error('database unavailable');

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-queued-stop-persist-fail-markfailed-fail',
      status: 'queued',
      metadata: {}
    },
    cancelQueuedResult: true,
    markStoppedError,
    markFailedError: new Error('secondary write failed')
  });

  await assert.rejects(
    service.cancelDeployment({
      projectId: project.id,
      deploymentId: 'dep-queued-stop-persist-fail-markfailed-fail',
      correlationId: 'corr-cancel-3d'
    }),
    markStoppedError
  );
});

test('cancelDeployment normalizes non-object metadata before marking cancellation requested', async () => {
  const cancellationRequests: Array<{ deploymentId: string; metadata: Record<string, unknown>; requestedByCorrelationId: string }> = [];

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-building',
      status: 'building',
      metadata: 'invalid-metadata-shape'
    },
    onMarkCancellationRequested: (input) => cancellationRequests.push(input),
    onAppendLog: () => undefined
  });

  const result = await service.cancelDeployment({
    projectId: project.id,
    deploymentId: 'dep-building',
    correlationId: 'corr-cancel-4'
  });

  assert.equal(result.cancellation, 'requested');
  assert.equal(cancellationRequests.length, 1);
  assert.deepEqual(cancellationRequests[0]?.metadata, {});
});

test('cancelDeployment still returns requested when cancellation log write fails after request metadata is saved', async () => {
  const cancellationRequests: Array<{ deploymentId: string; metadata: Record<string, unknown>; requestedByCorrelationId: string }> = [];

  const service = buildService({
    deploymentByIdResult: {
      id: 'dep-building-log-fail',
      status: 'building',
      metadata: { release: '2026.03.17' }
    },
    appendLogError: new Error('log insert failed'),
    onMarkCancellationRequested: (input) => cancellationRequests.push(input)
  });

  const result = await service.cancelDeployment({
    projectId: project.id,
    deploymentId: 'dep-building-log-fail',
    correlationId: 'corr-cancel-4b'
  });

  assert.deepEqual(result, {
    deploymentId: 'dep-building-log-fail',
    status: 'building',
    cancellation: 'requested'
  });
  assert.equal(cancellationRequests.length, 1);
  assert.deepEqual(cancellationRequests[0]?.metadata, { release: '2026.03.17' });
});


for (const disallowedStatus of ['running', 'failed', 'stopped'] as const) {
  test(`cancelDeployment rejects status ${disallowedStatus}`, async () => {
    const service = buildService({
      deploymentByIdResult: {
        id: `dep-${disallowedStatus}`,
        status: disallowedStatus,
        metadata: {}
      }
    });

    await assert.rejects(
      service.cancelDeployment({
        projectId: project.id,
        deploymentId: `dep-${disallowedStatus}`,
        correlationId: 'corr-cancel-disallowed'
      }),
      (error: unknown) => error instanceof DeploymentCancellationNotAllowedError
        && error.message.includes(disallowedStatus)
    );
  });
}
