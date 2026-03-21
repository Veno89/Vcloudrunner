import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { createDeploymentJobProcessor } = await import('./deployment-job-processor.js');

const jobData = {
  deploymentId: 'dep-123',
  projectId: 'proj-123',
  projectSlug: 'demo-project',
  correlationId: 'corr-123',
  gitRepositoryUrl: 'https://example.com/repo.git',
  branch: 'main',
  commitSha: 'abc123',
  env: {},
  runtime: {
    containerPort: 3000,
    memoryMb: 512,
    cpuMillicores: 500
  }
};

function createJob(overrides?: Partial<typeof jobData>) {
  return {
    id: 'job-123',
    attemptsMade: 0,
    opts: { attempts: 1 },
    data: {
      ...jobData,
      ...overrides
    }
  };
}

test('processor keeps successful deployments successful when the final running log append fails', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const infoLogs: string[] = [];
  const markRunningCalls: Array<Record<string, unknown>> = [];
  const stateFailures: string[] = [];
  let appendLogCallCount = 0;

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => ({
        containerId: 'container-123',
        containerName: 'container-name',
        imageTag: 'image-tag',
        hostPort: null,
        runtimeUrl: 'http://demo-project.example.test',
        internalPort: 3000,
        projectPath: 'repo'
      }),
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => {
        appendLogCallCount += 1;
        if (appendLogCallCount === 3) {
          throw new Error('log insert failed');
        }
      },
      markRunning: async (input) => {
        markRunningCalls.push(input as unknown as Record<string, unknown>);
      },
      markFailed: async (deploymentId) => {
        stateFailures.push(deploymentId);
      }
    },
    caddyService: {
      upsertRoute: async () => undefined
    },
    logger: {
      info: (message) => {
        infoLogs.push(message);
      },
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await processJob(createJob());

  assert.equal(markRunningCalls.length, 1);
  assert.deepEqual(stateFailures, []);
  assert.ok(infoLogs.includes('deployment finished'));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment post-run log append failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'running');
});

test('processor continues into runtime execution when pre-run informational log writes fail', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const markRunningCalls: Array<Record<string, unknown>> = [];
  let appendLogCallCount = 0;

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => ({
        containerId: 'container-123',
        containerName: 'container-name',
        imageTag: 'image-tag',
        hostPort: null,
        runtimeUrl: 'http://demo-project.example.test',
        internalPort: 3000,
        projectPath: 'repo'
      }),
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => {
        appendLogCallCount += 1;
        if (appendLogCallCount <= 2) {
          throw new Error('pre-run log insert failed');
        }
      },
      markRunning: async (input) => {
        markRunningCalls.push(input as unknown as Record<string, unknown>);
      },
      markFailed: async () => undefined
    },
    caddyService: {
      upsertRoute: async () => undefined
    },
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await processJob(createJob());

  assert.equal(markRunningCalls.length, 1);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0]?.message, 'deployment worker log append failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'pre-run');
  assert.equal(warnings[1]?.message, 'deployment worker log append failed; continuing deployment');
  assert.equal(warnings[1]?.metadata?.stage, 'pre-run');
});

test('processor keeps successful deployments successful when route warning log append fails after Caddy failure', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const markRunningCalls: Array<Record<string, unknown>> = [];
  const stateFailures: string[] = [];
  let appendLogCallCount = 0;

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => ({
        containerId: 'container-123',
        containerName: 'container-name',
        imageTag: 'image-tag',
        hostPort: 3100,
        runtimeUrl: 'http://demo-project.example.test',
        internalPort: 3000,
        projectPath: 'repo'
      }),
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => {
        appendLogCallCount += 1;
        if (appendLogCallCount === 3) {
          throw new Error('warning log insert failed');
        }
      },
      markRunning: async (input) => {
        markRunningCalls.push(input as unknown as Record<string, unknown>);
      },
      markFailed: async (deploymentId) => {
        stateFailures.push(deploymentId);
      }
    },
    caddyService: {
      upsertRoute: async () => {
        throw new Error('caddy unavailable');
      }
    },
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await processJob(createJob());

  assert.equal(markRunningCalls.length, 1);
  assert.deepEqual(stateFailures, []);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0]?.message, 'failed to configure caddy route; continuing deployment');
  assert.equal(warnings[1]?.message, 'deployment post-run log append failed; continuing deployment');
  assert.equal(warnings[1]?.metadata?.stage, 'route-config-skipped');
});

test('processor still rethrows the original retryable error when retry logging fails', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  let appendLogCallCount = 0;

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => {
        throw new Error('network timeout pulling image');
      },
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => {
        appendLogCallCount += 1;
        if (appendLogCallCount === 3) {
          throw new Error('retry log insert failed');
        }
      },
      markRunning: async () => undefined,
      markFailed: async () => undefined
    },
    caddyService: {
      upsertRoute: async () => undefined
    },
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(
    processJob({
      ...createJob(),
      opts: { attempts: 2 }
    }),
    /network timeout pulling image/
  );

  assert.equal(warnings.length, 2);
  assert.equal(warnings[0]?.message, 'deployment worker log append failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'retry-scheduled');
  assert.equal(warnings[1]?.message, 'deployment attempt failed; retry scheduled');
});

test('processor cleans up started runtime before failing an exhausted post-run persistence error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const failureMessages: string[] = [];

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => ({
        containerId: 'container-123',
        containerName: 'container-name',
        imageTag: 'image-tag',
        hostPort: 3100,
        runtimeUrl: 'http://demo-project.example.test',
        internalPort: 3000,
        projectPath: 'repo'
      }),
      cleanupCancelledRun: async (input) => {
        cleanupCalls.push(input as unknown as Record<string, unknown>);
      }
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => {
        throw new Error('database unavailable');
      },
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: {
      upsertRoute: async () => undefined
    },
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /database unavailable/);

  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0]?.deploymentId, 'dep-123');
  assert.equal(cleanupCalls[0]?.containerId, 'container-123');
  assert.equal(cleanupCalls[0]?.imageTag, 'image-tag');
  assert.equal(failureMessages.length, 1);
  assert.match(failureMessages[0] ?? '', /^\[DEPLOYMENT_TRANSIENT_FAILURE\] database unavailable$/);
});

test('processor cleans up started runtime before finalizing cancellation after a post-run error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const stopMessages: string[] = [];
  let cancellationChecks = 0;

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => ({
        containerId: 'container-123',
        containerName: 'container-name',
        imageTag: 'image-tag',
        hostPort: 3100,
        runtimeUrl: 'http://demo-project.example.test',
        internalPort: 3000,
        projectPath: 'repo'
      }),
      cleanupCancelledRun: async (input) => {
        cleanupCalls.push(input as unknown as Record<string, unknown>);
      }
    },
    stateService: {
      isCancellationRequested: async () => {
        cancellationChecks += 1;
        return cancellationChecks >= 3;
      },
      markStopped: async (_deploymentId, message) => {
        stopMessages.push(message);
      },
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => {
        throw new Error('database unavailable');
      },
      markFailed: async () => {
        throw new Error('markFailed should not be called for cancellation finalization');
      }
    },
    caddyService: {
      upsertRoute: async () => undefined
    },
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await processJob(createJob());

  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0]?.deploymentId, 'dep-123');
  assert.equal(stopMessages.length, 1);
  assert.match(stopMessages[0] ?? '', /cancellation confirmed after execution error/i);
});
