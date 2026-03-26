import { Pool } from 'pg';

import { env } from '../config/env.js';
import type { Queryable } from './deployment-state.repository.js';
import type { PoolConstructor } from './deployment-state-queryable.factory.js';

interface CreateConfiguredDeploymentStateQueryableOptions {
  PoolClass?: PoolConstructor;
}

export function createConfiguredDeploymentStateQueryable(
  options: CreateConfiguredDeploymentStateQueryableOptions = {}
): Queryable {
  const PoolClass = options.PoolClass ?? (Pool as unknown as PoolConstructor);

  return new PoolClass({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.DB_POOL_STATEMENT_TIMEOUT_MS
  });
}
