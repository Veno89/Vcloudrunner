import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createRepositoryFileInspector } = await import('./repository-file-inspector.factory.js');
const { GitRepositoryFileInspector } = await import('./git-repository-file-inspector.js');

test('createRepositoryFileInspector returns the configured repository file inspector implementation', () => {
  const inspector = createRepositoryFileInspector();

  assert.ok(inspector instanceof GitRepositoryFileInspector);
});
