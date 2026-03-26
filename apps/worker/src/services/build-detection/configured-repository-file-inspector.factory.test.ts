import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { createConfiguredRepositoryFileInspector } = await import('./configured-repository-file-inspector.factory.js');
const { GitRepositoryFileInspector } = await import('./git-repository-file-inspector.js');

test('createConfiguredRepositoryFileInspector returns the configured repository file inspector implementation', () => {
  const inspector = createConfiguredRepositoryFileInspector();

  assert.ok(inspector instanceof GitRepositoryFileInspector);
});
