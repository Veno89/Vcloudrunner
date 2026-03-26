import assert from 'node:assert/strict';
import test from 'node:test';

await import('../test/worker-test-env.js');

const { env } = await import('../config/env.js');
const { createConfiguredDeploymentStateQueryable } = await import('./configured-deployment-state-queryable.factory.js');

test('createConfiguredDeploymentStateQueryable wires the configured database pool options', () => {
  class FakePool {
    constructor(
      public readonly options: {
        connectionString: string;
        max: number;
        idleTimeoutMillis: number;
        connectionTimeoutMillis: number;
        statement_timeout: number;
      }
    ) {}

    async query() {
      return { rows: [] };
    }
  }

  const pool = createConfiguredDeploymentStateQueryable({
    PoolClass: FakePool as never
  }) as unknown as FakePool;

  assert.deepEqual(pool.options, {
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.DB_POOL_STATEMENT_TIMEOUT_MS
  });
});
