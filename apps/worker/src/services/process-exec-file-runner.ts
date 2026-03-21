import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface ExecFileResult {
  stdout: string;
  stderr: string;
}

export interface ExecFileRunOptions {
  cwd?: string;
}

export type ExecFileRunner = (
  file: string,
  args: string[],
  options?: ExecFileRunOptions
) => Promise<ExecFileResult>;

const execFileAsync = promisify(execFile);

export const execFileRunner: ExecFileRunner = async (file, args, options) => {
  const result = await execFileAsync(file, args, {
    ...options,
    encoding: 'utf8'
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
};
