import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { DockerfileBuildDetector } = await import('./dockerfile-detector.js');

test('DockerfileBuildDetector returns the first matching common candidate path', async () => {
  const checkedPaths: string[] = [];
  let listPathsCalls = 0;

  const detector = new DockerfileBuildDetector({
    async pathExists(_repoDir: string, filePath: string) {
      checkedPaths.push(filePath);
      return filePath === 'docker/Dockerfile';
    },
    async listPaths() {
      listPathsCalls += 1;
      return ['Dockerfile'];
    }
  });

  const result = await detector.detect('repo-dir');

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'docker/Dockerfile',
    buildContextPath: '.'
  });
  assert.deepEqual(checkedPaths, ['Dockerfile', 'dockerfile', 'docker/Dockerfile']);
  assert.equal(listPathsCalls, 0);
});

test('DockerfileBuildDetector scopes common candidate checks to the selected service root', async () => {
  const checkedPaths: string[] = [];
  let listPathsCalls = 0;

  const detector = new DockerfileBuildDetector({
    async pathExists(_repoDir: string, filePath: string) {
      checkedPaths.push(filePath);
      return filePath === 'apps/frontend/docker/Dockerfile';
    },
    async listPaths() {
      listPathsCalls += 1;
      return ['Dockerfile'];
    }
  });

  const result = await detector.detect('repo-dir', { sourceRoot: 'apps/frontend' });

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'apps/frontend/docker/Dockerfile',
    buildContextPath: 'apps/frontend'
  });
  assert.deepEqual(checkedPaths, [
    'apps/frontend/Dockerfile',
    'apps/frontend/dockerfile',
    'apps/frontend/docker/Dockerfile'
  ]);
  assert.equal(listPathsCalls, 0);
});

test('DockerfileBuildDetector falls back to repository tree scanning for any case-insensitive dockerfile match', async () => {
  const detector = new DockerfileBuildDetector({
    async pathExists() {
      return false;
    },
    async listPaths() {
      return ['README.md', 'services/api/dockerfile', 'apps/web/package.json'];
    }
  });

  const result = await detector.detect('repo-dir');

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'services/api/dockerfile',
    buildContextPath: '.'
  });
});

test('DockerfileBuildDetector limits fallback tree scans to files under the selected service root', async () => {
  const detector = new DockerfileBuildDetector({
    async pathExists() {
      return false;
    },
    async listPaths() {
      return ['Dockerfile', 'apps/frontend/dockerfile', 'apps/api/Dockerfile'];
    }
  });

  const result = await detector.detect('repo-dir', { sourceRoot: 'apps/frontend' });

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'apps/frontend/dockerfile',
    buildContextPath: 'apps/frontend'
  });
});

test('DockerfileBuildDetector returns null when no dockerfile-like path exists', async () => {
  const detector = new DockerfileBuildDetector({
    async pathExists() {
      return false;
    },
    async listPaths() {
      return ['README.md', 'package.json'];
    }
  });

  assert.equal(await detector.detect('repo-dir'), null);
});

test('DockerfileBuildDetector tolerates repository tree scan failures and returns null', async () => {
  const detector = new DockerfileBuildDetector({
    async pathExists() {
      return false;
    },
    async listPaths() {
      throw new Error('git unavailable');
    }
  });

  assert.equal(await detector.detect('repo-dir'), null);
});
