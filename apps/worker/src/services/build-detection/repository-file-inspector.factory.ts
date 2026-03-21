import type { RepositoryFileInspector } from './repository-file-inspector.js';
import { GitRepositoryFileInspector } from './git-repository-file-inspector.js';

export function createRepositoryFileInspector(): RepositoryFileInspector {
  return new GitRepositoryFileInspector();
}
