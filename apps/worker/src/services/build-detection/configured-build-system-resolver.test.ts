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
      async detect(repoDir: string, options) {
        calls.push(`first:${repoDir}:${options?.sourceRoot ?? '.'}`);
        return null;
      }
    },
    {
      name: 'second',
      async detect(repoDir: string, options) {
        calls.push(`second:${repoDir}:${options?.sourceRoot ?? '.'}`);
        return {
          type: 'dockerfile',
          buildFilePath: 'services/api/Dockerfile',
          buildContextPath: 'apps/frontend'
        };
      }
    },
    {
      name: 'third',
      async detect(repoDir: string, options) {
        calls.push(`third:${repoDir}:${options?.sourceRoot ?? '.'}`);
        return {
          type: 'dockerfile',
          buildFilePath: 'ignored/Dockerfile',
          buildContextPath: '.'
        };
      }
    }
  ] satisfies BuildSystemDetector[]);

  const result = await resolver.detect('repo-dir', { sourceRoot: 'apps/frontend' });

  assert.deepEqual(result, {
    type: 'dockerfile',
    buildFilePath: 'services/api/Dockerfile',
    buildContextPath: 'apps/frontend'
  });
  assert.deepEqual(calls, ['first:repo-dir:apps/frontend', 'second:repo-dir:apps/frontend']);
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
