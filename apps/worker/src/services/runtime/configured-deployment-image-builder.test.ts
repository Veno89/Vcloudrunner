import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { logger } = await import('../../logger/logger.js');
const { DeploymentFailure } = await import('../../workers/deployment-errors.js');
const { ConfiguredDeploymentImageBuilder } = await import('./configured-deployment-image-builder.js');

test('ConfiguredDeploymentImageBuilder clones the repo, resolves the build file, and builds the image', async (t) => {
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const cloneCalls: Array<{ gitRepositoryUrl: string; branch: string; repoDir: string }> = [];
  const buildCalls: Array<{
    dockerfilePath: string;
    buildContextPath: string;
    imageTag: string;
    repoDir: string;
  }> = [];
  const resolverCalls: Array<{ repoDir: string; sourceRoot?: string | null }> = [];

  t.mock.method(logger, 'info', (message: string, metadata?: Record<string, unknown>) => {
    infos.push({ message, metadata });
  });

  const imageBuilder = new ConfiguredDeploymentImageBuilder(
    {
      async cloneRepository(input) {
        cloneCalls.push(input);
      },
      async buildImage(input) {
        buildCalls.push(input);
      },
      async removeImage() {
        throw new Error('removeImage should not be called during build');
      }
    },
    {
      async detect(repoDir: string, options) {
        resolverCalls.push({ repoDir, sourceRoot: options?.sourceRoot ?? null });
        return {
          type: 'dockerfile',
          buildFilePath: 'apps/frontend/Dockerfile',
          buildContextPath: 'apps/frontend'
        };
      }
    }
  );

  const result = await imageBuilder.buildRuntimeImage({
    deploymentId: 'dep-123',
    gitRepositoryUrl: 'https://github.com/example/repo.git',
    branch: 'main',
    repoDir: 'repo-dir',
    imageTag: 'image-tag',
    sourceRoot: 'apps/frontend'
  });

  assert.deepEqual(cloneCalls, [
    {
      gitRepositoryUrl: 'https://github.com/example/repo.git',
      branch: 'main',
      repoDir: 'repo-dir'
    }
  ]);
  assert.deepEqual(resolverCalls, [{ repoDir: 'repo-dir', sourceRoot: 'apps/frontend' }]);
  assert.deepEqual(buildCalls, [
    {
      dockerfilePath: 'apps/frontend/Dockerfile',
      buildContextPath: 'apps/frontend',
      imageTag: 'image-tag',
      repoDir: 'repo-dir'
    }
  ]);
  assert.deepEqual(result, {
    buildFilePath: 'apps/frontend/Dockerfile',
    buildContextPath: 'apps/frontend'
  });
  assert.equal(infos[0]?.message, 'cloning repository');
  assert.equal(infos[0]?.metadata?.deploymentId, 'dep-123');
  assert.equal(infos[1]?.message, 'building docker image');
  assert.equal(infos[1]?.metadata?.dockerfilePath, 'apps/frontend/Dockerfile');
  assert.equal(infos[1]?.metadata?.buildContextPath, 'apps/frontend');
});

test('ConfiguredDeploymentImageBuilder throws a deployment failure when no build file is detected', async () => {
  const imageBuilder = new ConfiguredDeploymentImageBuilder(
    {
      async cloneRepository() {
        return undefined;
      },
      async buildImage() {
        throw new Error('buildImage should not be called without a detected build file');
      },
      async removeImage() {
        return undefined;
      }
    },
    {
      async detect() {
        return null;
      }
    }
  );

  await assert.rejects(
    imageBuilder.buildRuntimeImage({
      deploymentId: 'dep-123',
      gitRepositoryUrl: 'https://github.com/example/repo.git',
      branch: 'main',
      repoDir: 'repo-dir',
      imageTag: 'image-tag',
      sourceRoot: 'apps/frontend'
    }),
    (error: unknown) =>
      error instanceof DeploymentFailure &&
      error.code === 'DEPLOYMENT_DOCKERFILE_NOT_FOUND' &&
      error.retryable === false &&
      /selected service root "apps\/frontend"/.test(error.message)
  );
});

test('ConfiguredDeploymentImageBuilder delegates image removal to the command runner', async () => {
  const removedTags: string[] = [];
  const imageBuilder = new ConfiguredDeploymentImageBuilder(
    {
      async cloneRepository() {
        return undefined;
      },
      async buildImage() {
        return undefined;
      },
      async removeImage(imageTag: string) {
        removedTags.push(imageTag);
      }
    },
    {
      async detect() {
        return {
          type: 'dockerfile',
          buildFilePath: 'Dockerfile',
          buildContextPath: '.'
        };
      }
    }
  );

  await imageBuilder.removeImage('image-tag');

  assert.deepEqual(removedTags, ['image-tag']);
});
