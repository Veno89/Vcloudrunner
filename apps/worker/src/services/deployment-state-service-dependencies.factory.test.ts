import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { DeploymentStateRepository } = await import('./deployment-state.repository.js');
const { createDeploymentStateServiceDependencies } = await import('./deployment-state-service-dependencies.factory.js');

class MockPool {
  async query() {
    return { rows: [] };
  }
}

test('createDeploymentStateServiceDependencies wires the repository and preserves injected collaborators', () => {
  const ingressManager = {
    async deleteRoute() {}
  };
  const archiveUploader = {
    async createUploadRequest() {
      throw new Error('createUploadRequest should not run during dependency wiring');
    },
    async uploadWithRetry() {}
  };
  const archiveStore = {
    async ensureArchiveDir() {},
    async writeArchiveIfMissing() {
      return false;
    },
    async listUploadCandidates() {
      return [];
    },
    async readArchivePayload() {
      return Buffer.alloc(0);
    },
    async markUploaded() {},
    async deleteArchive() {},
    async listCleanupCandidates() {
      return [];
    },
    async deleteCleanupCandidate() {}
  };

  const dependencies = createDeploymentStateServiceDependencies({
    pool: new MockPool(),
    ingressManager,
    archiveUploader: archiveUploader as never,
    archiveStore: archiveStore as never
  });

  assert.ok(dependencies.repository instanceof DeploymentStateRepository);
  assert.equal(dependencies.ingressManager, ingressManager);
  assert.equal(dependencies.archiveUploader, archiveUploader);
  assert.equal(dependencies.archiveStore, archiveStore);
});
