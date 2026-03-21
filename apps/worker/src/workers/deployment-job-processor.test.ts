import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { createDeploymentJobProcessor } = await import('./deployment-job-processor.js');
const { DeploymentFailure } = await import('./deployment-errors.js');

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
const expectedRouteHost = `${jobData.projectSlug}.${env.PLATFORM_DOMAIN}`;

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

function createCaddyServiceStub(overrides: {
  upsertRoute?: (input: { host: string; upstreamPort: number }) => Promise<void>;
  deleteRoute?: (input: { host: string }) => Promise<void>;
} = {}) {
  return {
    upsertRoute: overrides.upsertRoute ?? (async () => undefined),
    deleteRoute: overrides.deleteRoute ?? (async () => undefined)
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
    caddyService: createCaddyServiceStub(),
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
    caddyService: createCaddyServiceStub(),
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

test('processor continues into runtime execution when the building event emission fails', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const markRunningCalls: Array<Record<string, unknown>> = [];

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
      appendLog: async () => undefined,
      markRunning: async (input) => {
        markRunningCalls.push(input as unknown as Record<string, unknown>);
      },
      markFailed: async () => undefined
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: (event) => {
      if (event.type === 'deployment.building') {
        throw new Error('event bus unavailable');
      }
    }
  });

  await processJob(createJob());

  assert.equal(markRunningCalls.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment event emission failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'building');
  assert.equal(warnings[0]?.metadata?.eventType, 'deployment.building');
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
    caddyService: createCaddyServiceStub({
      upsertRoute: async () => {
        throw new Error('caddy unavailable');
      }
    }),
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
    caddyService: createCaddyServiceStub(),
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

test('processor keeps successful deployments successful when the running event emission fails', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const infoLogs: string[] = [];
  const markRunningCalls: Array<Record<string, unknown>> = [];
  const stateFailures: string[] = [];

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
      appendLog: async () => undefined,
      markRunning: async (input) => {
        markRunningCalls.push(input as unknown as Record<string, unknown>);
      },
      markFailed: async (deploymentId) => {
        stateFailures.push(deploymentId);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: (message) => {
        infoLogs.push(message);
      },
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: (event) => {
      if (event.type === 'deployment.running') {
        throw new Error('event sink unavailable');
      }
    }
  });

  await processJob(createJob());

  assert.equal(markRunningCalls.length, 1);
  assert.deepEqual(stateFailures, []);
  assert.ok(infoLogs.includes('deployment finished'));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment event emission failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'running');
  assert.equal(warnings[0]?.metadata?.eventType, 'deployment.running');
});

test('processor still fails non-retryable deployments when failed event emission fails', async () => {
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const failureMessages: string[] = [];

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => {
        throw new DeploymentFailure('DEPLOYMENT_CONFIGURATION_ERROR', 'project access denied', false);
      },
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => false,
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => undefined,
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: (event) => {
      if (event.type === 'deployment.failed') {
        throw new Error('event sink unavailable');
      }
    }
  });

  await assert.rejects(processJob(createJob()), /project access denied/);

  assert.equal(failureMessages.length, 1);
  assert.match(failureMessages[0] ?? '', /^\[DEPLOYMENT_CONFIGURATION_ERROR\] project access denied$/);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment event emission failed; continuing deployment');
  assert.equal(warnings[0]?.metadata?.stage, 'failed');
  assert.equal(warnings[0]?.metadata?.eventType, 'deployment.failed');
});

test('processor marks cancelled-before-execution deployments failed when stop persistence fails', async () => {
  const failureMessages: string[] = [];

  const processJob = createDeploymentJobProcessor({
    runtimeExecutor: {
      run: async () => {
        throw new Error('runtime should not start after pre-execution cancellation');
      },
      cleanupCancelledRun: async () => undefined
    },
    stateService: {
      isCancellationRequested: async () => true,
      markStopped: async () => {
        throw new Error('database unavailable');
      },
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => undefined,
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /database unavailable/);

  assert.equal(failureMessages.length, 1);
  assert.equal(failureMessages[0], 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED: database unavailable');
});

test('processor marks cancelled-during-execution deployments failed when stop persistence fails', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const failureMessages: string[] = [];
  let cancellationChecks = 0;

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
      cleanupCancelledRun: async (input) => {
        cleanupCalls.push(input as unknown as Record<string, unknown>);
      }
    },
    stateService: {
      isCancellationRequested: async () => {
        cancellationChecks += 1;
        return cancellationChecks >= 2;
      },
      markStopped: async () => {
        throw new Error('database unavailable');
      },
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => undefined,
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
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
  assert.equal(failureMessages.length, 1);
  assert.equal(failureMessages[0], 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED: database unavailable');
});

test('processor marks cancelled-during-execution deployments failed when runtime cleanup keeps failing', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const failureMessages: string[] = [];
  const stopMessages: string[] = [];
  let cancellationChecks = 0;

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
      cleanupCancelledRun: async (input) => {
        cleanupCalls.push(input as unknown as Record<string, unknown>);
        throw new Error('cleanup unavailable');
      }
    },
    stateService: {
      isCancellationRequested: async () => {
        cancellationChecks += 1;
        return cancellationChecks >= 2;
      },
      markStopped: async (_deploymentId, message) => {
        stopMessages.push(message);
      },
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => undefined,
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /cleanup unavailable/);

  assert.equal(cleanupCalls.length, 2);
  assert.equal(stopMessages.length, 0);
  assert.equal(failureMessages.length, 1);
  assert.equal(failureMessages[0], 'DEPLOYMENT_CANCEL_RUNTIME_CLEANUP_FAILED: cleanup unavailable');
});

test('processor emits a cancelled event when cancellation completes during execution', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const emittedEvents: Array<Record<string, unknown>> = [];
  let cancellationChecks = 0;

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
      cleanupCancelledRun: async (input) => {
        cleanupCalls.push(input as unknown as Record<string, unknown>);
      }
    },
    stateService: {
      isCancellationRequested: async () => {
        cancellationChecks += 1;
        return cancellationChecks >= 2;
      },
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => undefined,
      markFailed: async () => undefined
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: (event) => {
      emittedEvents.push(event as unknown as Record<string, unknown>);
    }
  });

  await processJob(createJob());

  assert.equal(cleanupCalls.length, 1);
  assert.equal(emittedEvents.length, 2);
  assert.equal(emittedEvents[0]?.type, 'deployment.building');
  assert.equal(emittedEvents[1]?.type, 'deployment.cancelled');
  assert.equal(emittedEvents[1]?.deploymentId, 'dep-123');
  assert.equal((emittedEvents[1]?.details as Record<string, unknown>)?.containerId, 'container-123');
});

test('processor cleans up started runtime before failing an exhausted post-run persistence error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const deleteRouteCalls: Array<Record<string, unknown>> = [];
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
    caddyService: createCaddyServiceStub({
      deleteRoute: async (input) => {
        deleteRouteCalls.push(input as unknown as Record<string, unknown>);
      }
    }),
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
  assert.equal(deleteRouteCalls.length, 1);
  assert.equal(deleteRouteCalls[0]?.host, expectedRouteHost);
  assert.equal(failureMessages.length, 1);
  assert.match(failureMessages[0] ?? '', /^\[DEPLOYMENT_TRANSIENT_FAILURE\] database unavailable$/);
});

test('processor cleans up started runtime before finalizing cancellation after a post-run error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const deleteRouteCalls: Array<Record<string, unknown>> = [];
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
    caddyService: createCaddyServiceStub({
      deleteRoute: async (input) => {
        deleteRouteCalls.push(input as unknown as Record<string, unknown>);
      }
    }),
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
  assert.equal(deleteRouteCalls.length, 1);
  assert.equal(deleteRouteCalls[0]?.host, expectedRouteHost);
  assert.equal(stopMessages.length, 1);
  assert.match(stopMessages[0] ?? '', /cancellation confirmed after execution error/i);
});

test('processor warns and continues when route cleanup fails after a post-run error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
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
    caddyService: createCaddyServiceStub({
      deleteRoute: async () => {
        throw new Error('caddy delete unavailable');
      }
    }),
    logger: {
      info: () => undefined,
      warn: (message, metadata) => {
        warnings.push({ message, metadata });
      },
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /database unavailable/);

  assert.equal(cleanupCalls.length, 1);
  assert.equal(failureMessages.length, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.message, 'deployment route cleanup failed after post-run error');
  assert.equal(warnings[0]?.metadata?.host, expectedRouteHost);
});

test('processor marks cancellation finalization failed when stop persistence fails after an execution error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const failureMessages: string[] = [];
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
      markStopped: async () => {
        throw new Error('stop persistence unavailable');
      },
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => {
        throw new Error('database unavailable');
      },
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /stop persistence unavailable/);

  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0]?.deploymentId, 'dep-123');
  assert.equal(failureMessages.length, 1);
  assert.equal(failureMessages[0], 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED: stop persistence unavailable');
});

test('processor marks cancellation-after-error deployments failed when runtime cleanup fails', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const failureMessages: string[] = [];
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
        throw new Error('cleanup unavailable');
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
      markFailed: async (_deploymentId, message) => {
        failureMessages.push(message);
      }
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: () => undefined
  });

  await assert.rejects(processJob(createJob()), /cleanup unavailable/);

  assert.equal(cleanupCalls.length, 1);
  assert.equal(stopMessages.length, 0);
  assert.equal(failureMessages.length, 1);
  assert.equal(failureMessages[0], 'DEPLOYMENT_CANCEL_RUNTIME_CLEANUP_FAILED: cleanup unavailable');
});

test('processor emits a cancelled event when cancellation finalizes after an execution error', async () => {
  const cleanupCalls: Array<Record<string, unknown>> = [];
  const emittedEvents: Array<Record<string, unknown>> = [];
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
      markStopped: async () => undefined,
      markBuilding: async () => undefined,
      appendLog: async () => undefined,
      markRunning: async () => {
        throw new Error('database unavailable');
      },
      markFailed: async () => undefined
    },
    caddyService: createCaddyServiceStub(),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    emitDeploymentEvent: (event) => {
      emittedEvents.push(event as unknown as Record<string, unknown>);
    }
  });

  await processJob(createJob());

  assert.equal(cleanupCalls.length, 1);
  assert.equal(emittedEvents.length, 2);
  assert.equal(emittedEvents[0]?.type, 'deployment.building');
  assert.equal(emittedEvents[1]?.type, 'deployment.cancelled');
  assert.equal(emittedEvents[1]?.deploymentId, 'dep-123');
});
