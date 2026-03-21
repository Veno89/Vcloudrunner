import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { logger } = await import('../../logger/logger.js');
const { DeploymentFailure } = await import('../../workers/deployment-errors.js');
const { ConfiguredDeploymentImageBuilder } = await import('./configured-deployment-image-builder.js');

test('ConfiguredDeploymentImageBuilder clones the repo, resolves the build file, and builds the image', async (t) => {
  const infos: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const cloneCalls: Array<{ gitRepositoryUrl: string; branch: string; repoDir: string }> = [];
  const buildCalls: Array<{ dockerfilePath: string; imageTag: string; repoDir: string }> = [];
  const resolverCalls: string[] = [];

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
      async detect(repoDir: string) {
        resolverCalls.push(repoDir);
        return {
          type: 'dockerfile',
          buildFilePath: 'services/api/Dockerfile'
        };
      }
    }
  );

  const result = await imageBuilder.buildRuntimeImage({
    deploymentId: 'dep-123',
    gitRepositoryUrl: 'https://github.com/example/repo.git',
    branch: 'main',
    repoDir: 'repo-dir',
    imageTag: 'image-tag'
  });

  assert.deepEqual(cloneCalls, [
    {
      gitRepositoryUrl: 'https://github.com/example/repo.git',
      branch: 'main',
      repoDir: 'repo-dir'
    }
  ]);
  assert.deepEqual(resolverCalls, ['repo-dir']);
  assert.deepEqual(buildCalls, [
    {
      dockerfilePath: 'services/api/Dockerfile',
      imageTag: 'image-tag',
      repoDir: 'repo-dir'
    }
  ]);
  assert.deepEqual(result, {
    buildFilePath: 'services/api/Dockerfile'
  });
  assert.equal(infos[0]?.message, 'cloning repository');
  assert.equal(infos[0]?.metadata?.deploymentId, 'dep-123');
  assert.equal(infos[1]?.message, 'building docker image');
  assert.equal(infos[1]?.metadata?.dockerfilePath, 'services/api/Dockerfile');
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
      imageTag: 'image-tag'
    }),
    (error: unknown) =>
      error instanceof DeploymentFailure &&
      error.code === 'DEPLOYMENT_DOCKERFILE_NOT_FOUND' &&
      error.retryable === false
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
          buildFilePath: 'Dockerfile'
        };
      }
    }
  );

  await imageBuilder.removeImage('image-tag');

  assert.deepEqual(removedTags, ['image-tag']);
});
