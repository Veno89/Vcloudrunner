import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { DeploymentStateRepository } = await import('./deployment-state.repository.js');

interface RecordedQuery {
  text: string;
  params: unknown[] | undefined;
}

class MockPool {
  readonly queries: RecordedQuery[] = [];

  constructor(
    private readonly onQuery?: (text: string, params: unknown[] | undefined) => void | Promise<void>
  ) {}

  async query(text: string, params?: unknown[]) {
    this.queries.push({ text, params });
    await this.onQuery?.(text, params);
    return { rows: [] };
  }
}

const successInput = {
  deploymentId: 'dep-123',
  containerId: 'container-123',
  imageTag: 'image-tag',
  internalPort: 3000,
  hostPort: 3100,
  runtimeUrl: 'https://demo.example.test',
  projectId: 'proj-123',
  projectSlug: 'demo-project'
};

test('markRunning rolls back and rethrows the original write error', async () => {
  const pool = new MockPool(async (text) => {
    if (/insert into domains/i.test(text)) {
      throw new Error('domain write failed');
    }
  });
  const repository = new DeploymentStateRepository(pool);

  await assert.rejects(repository.markRunning(successInput), /domain write failed/);

  assert.equal(pool.queries.length, 5);
  assert.equal(pool.queries[0]?.text, 'begin');
  assert.match(pool.queries[1]?.text ?? '', /update deployments/i);
  assert.match(pool.queries[2]?.text ?? '', /insert into containers/i);
  assert.match(pool.queries[3]?.text ?? '', /insert into domains/i);
  assert.equal(pool.queries[4]?.text, 'rollback');
  assert.deepEqual(pool.queries[3]?.params, [
    'proj-123',
    'dep-123',
    `demo-project.${env.PLATFORM_DOMAIN}`,
    3100
  ]);
});

test('markRunning preserves the original write error when rollback also fails', async () => {
  const pool = new MockPool(async (text) => {
    if (/insert into containers/i.test(text)) {
      throw new Error('container write failed');
    }

    if (text === 'rollback') {
      throw new Error('rollback unavailable');
    }
  });
  const repository = new DeploymentStateRepository(pool);

  await assert.rejects(
    repository.markRunning(successInput),
    /container write failed \(rollback failed: rollback unavailable\)/
  );

  assert.equal(pool.queries.length, 4);
  assert.equal(pool.queries[0]?.text, 'begin');
  assert.match(pool.queries[1]?.text ?? '', /update deployments/i);
  assert.match(pool.queries[2]?.text ?? '', /insert into containers/i);
  assert.equal(pool.queries[3]?.text, 'rollback');
});

test('markStatusFailed clears runtimeUrl when marking a deployment failed', async () => {
  const pool = new MockPool();
  const repository = new DeploymentStateRepository(pool);

  await repository.markStatusFailed('dep-failed');

  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0]?.text ?? '', /update deployments/i);
  assert.match(pool.queries[0]?.text ?? '', /runtime_url = null/i);
  assert.deepEqual(pool.queries[0]?.params, ['dep-failed']);
});
