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
