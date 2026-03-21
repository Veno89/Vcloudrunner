import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerRuntimeExecutor } = await import('./docker-runtime-executor.js');

test('DockerRuntimeExecutor delegates runtime execution and cleanup to the injected deployment runner', async () => {
  const expectedResult = {
    containerId: 'container-123',
    containerName: 'vcloudrunner-demo-project-dep-123',
    imageTag: 'vcloudrunner/demo-project:dep-123',
    hostPort: 45123,
    runtimeUrl: 'http://demo-project.example.test',
    internalPort: 3000,
    projectPath: 'C:/tmp/deployments/demo-project'
  };

  const job = {
    deploymentId: 'dep-123',
    projectId: 'project-123',
    projectSlug: 'demo-project',
    gitRepositoryUrl: 'https://example.test/demo-project.git',
    branch: 'main',
    env: {}
  };
  const cleanupInput = {
    deploymentId: 'dep-123',
    containerId: 'container-123',
    imageTag: 'vcloudrunner/demo-project:dep-123'
  };
  const calls: Array<{ type: 'run' | 'cleanup'; input: unknown }> = [];

  const executor = new DockerRuntimeExecutor({
    async run(input) {
      calls.push({ type: 'run', input });
      return expectedResult;
    },
    async cleanupCancelledRun(input) {
      calls.push({ type: 'cleanup', input });
    }
  });

  assert.deepEqual(await executor.run(job as never), expectedResult);
  await executor.cleanupCancelledRun(cleanupInput);

  assert.deepEqual(calls, [
    { type: 'run', input: job },
    { type: 'cleanup', input: cleanupInput }
  ]);
});
