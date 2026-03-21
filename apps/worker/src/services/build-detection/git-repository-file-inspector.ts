import { execFileRunner, type ExecFileRunner } from '../process-exec-file-runner.js';
import type { RepositoryFileInspector } from './repository-file-inspector.js';

export class GitRepositoryFileInspector implements RepositoryFileInspector {
  constructor(private readonly execRunner: ExecFileRunner = execFileRunner) {}

  async pathExists(repoDir: string, filePath: string): Promise<boolean> {
    try {
      await this.execRunner('git', ['-C', repoDir, 'cat-file', '-e', `HEAD:${filePath}`]);
      return true;
    } catch {
      return false;
    }
  }

  async listPaths(repoDir: string): Promise<string[]> {
    const { stdout } = await this.execRunner('git', ['-C', repoDir, 'ls-tree', '-r', '--name-only', 'HEAD']);

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}
