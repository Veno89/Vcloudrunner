import { createConfiguredDeploymentStateQueryable } from './configured-deployment-state-queryable.factory.js';
import type { Queryable } from './deployment-state.repository.js';

export type PoolConstructor = new (options: {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}) => Queryable;

interface CreateDeploymentStateQueryableOptions {
  PoolClass?: PoolConstructor;
}

export function createDeploymentStateQueryable(
  options: CreateDeploymentStateQueryableOptions = {}
): Queryable {
  if (!options.PoolClass) {
    return createConfiguredDeploymentStateQueryable();
  }

  return createConfiguredDeploymentStateQueryable({
    PoolClass: options.PoolClass
  });
}
