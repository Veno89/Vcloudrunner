import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { LocalDeploymentWorkspaceManager } = await import('./local-deployment-workspace-manager.js');

test('prepareWorkspace clears stale deployment contents and returns workspace paths', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-workspaces-'));
  const workspaceManager = new LocalDeploymentWorkspaceManager(workDir);
  const staleDir = join(workDir, 'dep-123');
  const staleFile = join(staleDir, 'stale.txt');

  try {
    await mkdir(staleDir, { recursive: true });
    await writeFile(staleFile, 'stale');

    const prepared = await workspaceManager.prepareWorkspace('dep-123');

    await assert.rejects(access(staleFile));
    await access(prepared.workspaceDir);
    assert.equal(prepared.workspaceDir, staleDir);
    assert.equal(prepared.repoDir, join(staleDir, 'repo'));
    assert.equal(prepared.projectPath, 'repo');
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test('cleanupWorkspace removes the prepared deployment workspace', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-workspaces-'));
  const workspaceManager = new LocalDeploymentWorkspaceManager(workDir);

  try {
    const prepared = await workspaceManager.prepareWorkspace('dep-456');

    await workspaceManager.cleanupWorkspace(prepared.workspaceDir);

    await assert.rejects(access(prepared.workspaceDir));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
