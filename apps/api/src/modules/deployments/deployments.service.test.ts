import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DeploymentAlreadyActiveError,
  DeploymentCancellationNotAllowedError,
  DeploymentNotFoundError,
  DeploymentQueueUnavailableError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/vcloudrunner';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ENCRYPTION_KEY ??= '12345678901234567890123456789012';

const { DeploymentsService } = await import('./deployments.service.js');

const project = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'demo-project',
  gitRepositoryUrl: 'https://example.com/repo.git',
  defaultBranch: 'main'
};

const createdDeployment = {
  id: '11111111-1111-1111-1111-111111111111'
};

function buildService(overrides?: {
  projectResult?: typeof project | null;
  createResult?: { id: string } | null;
  createError?: unknown;
  enqueueError?: Error;
  markFailedError?: Error;
  onMarkFailed?: (deploymentId: string, message: string) => void;
  deploymentByIdResult?: { id: string; status: 'queued' | 'building' | 'running' | 'failed' | 'stopped'; metadata?: unknown } | null;
  cancelQueuedResult?: boolean;
  cancelQueuedError?: Error;
  onMarkStopped?: (deploymentId: string) => void;
  onAppendLog?: (input: { deploymentId: string; level: string; message: string }) => void;
  appendLogError?: Error;
  onMarkCancellationRequested?: (input: { deploymentId: string; metadata: Record<string, unknown>; requestedByCorrelationId: string }) => void;
}) {
  const queue = {
    enqueue: async () => {
      if (overrides?.enqueueError) {
        throw overrides.enqueueError;
      }

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
    } as never,
    deploymentsRepository: {
      createIfNoActiveDeployment: async () => {
        if (overrides?.createError) {
          throw overrides.createError;
        }

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
      },
      appendLog: async (input: { deploymentId: string; level: string; message: string }) => {
        overrides?.onAppendLog?.(input);

        if (overrides?.appendLogError) {
          throw overrides.appendLogError;
        }
      }
    } as never,
    environmentRepository: {
      listByProject: async () => []
    } as never,
    cryptoService: {
      decrypt: (value: string) => value
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
    createError: { code: '23505', constraint: 'deployments_project_single_active_idx', table: 'deployments' }
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
    createError: { code: '23505', constraint: 'deployments_project_single_active_idx' }
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
    createError: { code: '23505', constraint: 'deployments_project_single_active_idx', table: 'projects' }
  });

  await assert.rejects(
    service.createDeployment({
      projectId: project.id,
      correlationId: 'corr-5b'
    }),
    (error: unknown) => {
      const e = error as { code?: unknown; constraint?: unknown; table?: unknown };
      return e.code === '23505' && e.constraint === 'deployments_project_single_active_idx' && e.table === 'projects';
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
