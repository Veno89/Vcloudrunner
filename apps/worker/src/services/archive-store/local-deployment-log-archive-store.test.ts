import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

await import('../../test/worker-test-env.js');

const { LocalDeploymentLogArchiveStore } = await import('./local-deployment-log-archive-store.js');

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test('writeArchiveIfMissing writes a new archive once and then preserves idempotency', async () => {
  const archiveDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-archive-store-'));
  const archiveStore = new LocalDeploymentLogArchiveStore(archiveDir);

  try {
    const first = await archiveStore.writeArchiveIfMissing('dep-123', Buffer.from('payload-one'));
    const second = await archiveStore.writeArchiveIfMissing('dep-123', Buffer.from('payload-two'));

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(await exists(join(archiveDir, 'dep-123.ndjson.gz')), true);
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
});

test('listUploadCandidates skips marker-backed archives and non-archive files', async () => {
  const archiveDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-archive-store-'));
  const archiveStore = new LocalDeploymentLogArchiveStore(archiveDir);

  try {
    await writeFile(join(archiveDir, 'dep-a.ndjson.gz'), 'a');
    await writeFile(join(archiveDir, 'dep-b.ndjson.gz'), 'b');
    await writeFile(join(archiveDir, 'dep-b.ndjson.gz.uploaded'), 'uploaded');
    await writeFile(join(archiveDir, 'README.txt'), 'ignore');

    const candidates = await archiveStore.listUploadCandidates();

    assert.deepEqual(candidates, [
      {
        fileName: 'dep-a.ndjson.gz',
        archivePath: join(archiveDir, 'dep-a.ndjson.gz'),
        markerPath: join(archiveDir, 'dep-a.ndjson.gz.uploaded')
      }
    ]);
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
});

test('listCleanupCandidates returns expired marker and archived-file cleanup targets', async () => {
  const archiveDir = await mkdtemp(join(tmpdir(), 'vcloudrunner-archive-store-'));
  const archiveStore = new LocalDeploymentLogArchiveStore(archiveDir);
  const now = new Date();
  const old = new Date(now.getTime() - 60_000);
  const markerOnlyPath = join(archiveDir, 'dep-marker.ndjson.gz.uploaded');
  const archivedPath = join(archiveDir, 'dep-archive.ndjson.gz');
  const archivedMarkerPath = `${archivedPath}.uploaded`;
  const freshArchivePath = join(archiveDir, 'dep-fresh.ndjson.gz');
  const freshMarkerPath = `${freshArchivePath}.uploaded`;

  try {
    await writeFile(markerOnlyPath, 'uploaded');
    await writeFile(archivedPath, 'archive');
    await writeFile(archivedMarkerPath, 'uploaded');
    await writeFile(freshArchivePath, 'archive');
    await writeFile(freshMarkerPath, 'uploaded');
    await mkdir(join(archiveDir, 'ignored-dir'));

    await utimes(markerOnlyPath, old, old);
    await utimes(archivedPath, old, old);
    await utimes(archivedMarkerPath, old, old);

    const candidates = await archiveStore.listCleanupCandidates({
      nowMs: now.getTime(),
      archiveMaxAgeMs: 1_000,
      markerMaxAgeMs: 1_000
    });
    const sortedCandidates = [...candidates].sort((left, right) => left.fileName.localeCompare(right.fileName));

    assert.deepEqual(
      sortedCandidates,
      [
      {
        fileName: 'dep-archive.ndjson.gz',
        filePath: archivedPath
      },
      {
        fileName: 'dep-archive.ndjson.gz.uploaded',
        filePath: archivedMarkerPath
      },
      {
        fileName: 'dep-marker.ndjson.gz.uploaded',
        filePath: markerOnlyPath
      }
      ]
    );
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
});
