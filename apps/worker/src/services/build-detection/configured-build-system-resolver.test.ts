import assert from 'node:assert/strict';
import test from 'node:test';

import type { BuildSystemDetector } from './build-system-detector.js';

await import('../../test/worker-test-env.js');

const { ConfiguredBuildSystemResolver } = await import('./configured-build-system-resolver.js');

test('ConfiguredBuildSystemResolver returns the first matching detector result in order', async () => {
  const calls: string[] = [];
  const resolver = new ConfiguredBuildSystemResolver([
    {
      name: 'first',
      async detect(repoDir: string) {
        calls.push(`first:${repoDir}`);
        return null;
      }
    },
    {
      name: 'second',
      async detect(repoDir: string) {
        calls.push(`second:${repoDir}`);
        return {
          type: 'dockerfile',
          buildFilePath: 'services/api/Dockerfile'
        };
      }
    },
    {
      name: 'third',
      async detect(repoDir: string) {
        calls.push(`third:${repoDir}`);
        return {
          type: 'dockerfile',
          buildFilePath: 'ignored/Dockerfile'
        };
      }
    }
  ] satisfies BuildSystemDetector[]);

  const result = await resolver.detect('repo-dir');

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'services/api/Dockerfile'
  });
  assert.deepEqual(calls, ['first:repo-dir', 'second:repo-dir']);
});

test('ConfiguredBuildSystemResolver returns null when no detector matches', async () => {
  const resolver = new ConfiguredBuildSystemResolver([
    {
      name: 'dockerfile',
      async detect() {
        return null;
      }
    }
  ] satisfies BuildSystemDetector[]);

  assert.equal(await resolver.detect('repo-dir'), null);
});
