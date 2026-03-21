import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { GitRepositoryFileInspector } = await import('./git-repository-file-inspector.js');

test('GitRepositoryFileInspector pathExists returns true when git cat-file succeeds', async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const inspector = new GitRepositoryFileInspector(async (file, args) => {
    calls.push({ file, args });
    return { stdout: '' };
  });

  assert.equal(await inspector.pathExists('repo-dir', 'Dockerfile'), true);
  assert.deepEqual(calls, [
    {
      file: 'git',
      args: ['-C', 'repo-dir', 'cat-file', '-e', 'HEAD:Dockerfile']
    }
  ]);
});

test('GitRepositoryFileInspector pathExists returns false when git cat-file fails', async () => {
  const inspector = new GitRepositoryFileInspector(async () => {
    throw new Error('missing path');
  });

  assert.equal(await inspector.pathExists('repo-dir', 'Dockerfile'), false);
});

test('GitRepositoryFileInspector listPaths parses trimmed non-empty repository paths', async () => {
  const inspector = new GitRepositoryFileInspector(async () => ({
    stdout: 'Dockerfile\n services/api/dockerfile \n\nREADME.md\n'
  }));

  assert.deepEqual(await inspector.listPaths('repo-dir'), [
    'Dockerfile',
    'services/api/dockerfile',
    'README.md'
  ]);
});
