import type { RepositoryFileInspector } from './repository-file-inspector.js';
import { GitRepositoryFileInspector } from './git-repository-file-inspector.js';

export function createConfiguredRepositoryFileInspector(): RepositoryFileInspector {
  return new GitRepositoryFileInspector();
}
