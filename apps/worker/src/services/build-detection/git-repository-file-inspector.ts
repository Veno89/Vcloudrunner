import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { RepositoryFileInspector } from './repository-file-inspector.js';

interface ExecFileResult {
  stdout: string;
}

type ExecFileRunner = (file: string, args: string[]) => Promise<ExecFileResult>;

const execFileAsync = promisify(execFile);

const defaultExecFileRunner: ExecFileRunner = async (file, args) => {
  const result = await execFileAsync(file, args);

  return {
    stdout: result.stdout
  };
};

export class GitRepositoryFileInspector implements RepositoryFileInspector {
  constructor(private readonly execRunner: ExecFileRunner = defaultExecFileRunner) {}

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
