import assert from 'node:assert/strict';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { ShellDeploymentCommandRunner } = await import('./shell-deployment-command-runner.js');

test('ShellDeploymentCommandRunner clones repositories with the expected git command', async () => {
  const calls: Array<{ file: string; args: string[]; options?: { cwd?: string } }> = [];
  const commandRunner = new ShellDeploymentCommandRunner(async (file, args, options) => {
    calls.push({ file, args, options });
    return { stdout: '', stderr: '' };
  });

  await commandRunner.cloneRepository({
    gitRepositoryUrl: 'https://example.com/repo.git',
    branch: 'main',
    repoDir: 'repo-dir'
  });

  assert.deepEqual(calls, [
    {
      file: 'git',
      args: ['clone', '--depth', '1', '--branch', 'main', 'https://example.com/repo.git', 'repo-dir'],
      options: undefined
    }
  ]);
});

test('ShellDeploymentCommandRunner builds images with the expected docker command', async () => {
  const calls: Array<{ file: string; args: string[]; options?: { cwd?: string } }> = [];
  const commandRunner = new ShellDeploymentCommandRunner(async (file, args, options) => {
    calls.push({ file, args, options });
    return { stdout: '', stderr: '' };
  });

  await commandRunner.buildImage({
    dockerfilePath: 'services/api/Dockerfile',
    imageTag: 'example:latest',
    repoDir: 'repo-dir'
  });

  assert.deepEqual(calls, [
    {
      file: 'docker',
      args: ['build', '-f', 'services/api/Dockerfile', '-t', 'example:latest', '.'],
      options: { cwd: 'repo-dir' }
    }
  ]);
});

test('ShellDeploymentCommandRunner removes images with the expected docker command', async () => {
  const calls: Array<{ file: string; args: string[]; options?: { cwd?: string } }> = [];
  const commandRunner = new ShellDeploymentCommandRunner(async (file, args, options) => {
    calls.push({ file, args, options });
    return { stdout: '', stderr: '' };
  });

  await commandRunner.removeImage('example:latest');

  assert.deepEqual(calls, [
    {
      file: 'docker',
      args: ['image', 'rm', '-f', 'example:latest'],
      options: undefined
    }
  ]);
});
