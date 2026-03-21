import { Pool } from 'pg';

import { env } from '../config/env.js';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

export interface SuccessInput {
  deploymentId: string;
  containerId: string;
  imageTag: string;
  internalPort: number;
  hostPort: number | null;
  runtimeUrl: string | null;
  projectId: string;
  projectSlug: string;
}

interface DeploymentControlRow {
  status: string;
  metadata: unknown;
}

interface StuckDeploymentRow {
  id: string;
  status: string;
}

interface RunningContainerRow {
  deployment_id: string;
  container_id: string;
  project_slug: string;
  runtime_url: string | null;
}

interface ArchiveCandidateRow {
  id: string;
}

export interface DeploymentLogRow {
  id: string;
  deployment_id: string;
  level: string;
  message: string;
  timestamp: string;
}

export class DeploymentStateRepository {
  private readonly pool: Queryable;

  constructor(pool?: Queryable) {
    this.pool = pool ?? new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
      statement_timeout: env.DB_POOL_STATEMENT_TIMEOUT_MS
    });
  }

  async markBuilding(deploymentId: string) {
    await this.pool.query(
      `update deployments
       set status = 'building', started_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );
  }

  async markRunning(input: SuccessInput) {
    await this.pool.query('begin');
    try {
      await this.pool.query(
        `update deployments
         set status = 'running', runtime_url = $2, updated_at = now()
         where id = $1`,
        [input.deploymentId, input.runtimeUrl]
      );

      if (input.hostPort !== null) {
        await this.pool.query(
          `insert into containers (deployment_id, container_id, image, internal_port, host_port, is_healthy)
           values ($1, $2, $3, $4, $5, false)
           on conflict (deployment_id) do update
           set container_id = excluded.container_id,
               image = excluded.image,
               internal_port = excluded.internal_port,
               host_port = excluded.host_port,
               updated_at = now()`,
          [input.deploymentId, input.containerId, input.imageTag, input.internalPort, input.hostPort]
        );

        await this.pool.query(
          `insert into domains (project_id, deployment_id, host, target_port)
           values ($1, $2, $3, $4)
           on conflict (host) do update
           set deployment_id = excluded.deployment_id,
               target_port = excluded.target_port,
               updated_at = now()`,
          [input.projectId, input.deploymentId, `${input.projectSlug}.${env.PLATFORM_DOMAIN}`, input.hostPort]
        );
      }

      await this.pool.query('commit');
    } catch (error) {
      try {
        await this.pool.query('rollback');
      } catch (rollbackError) {
        throw new Error(`${getErrorMessage(error)} (rollback failed: ${getErrorMessage(rollbackError)})`);
      }
      throw error;
    }
  }

  async markStatusFailed(deploymentId: string) {
    await this.pool.query(
      `update deployments
       set status = 'failed', runtime_url = null, finished_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );
  }

  async markStatusStopped(deploymentId: string) {
    await this.pool.query(
      `update deployments
       set status = 'stopped', runtime_url = null, finished_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );
  }

  async insertLog(input: { deploymentId: string; level: string; message: string }) {
    await this.pool.query(
      `insert into deployment_logs (deployment_id, level, message)
       values ($1, $2, $3)`,
      [input.deploymentId, input.level, input.message.slice(0, 10000)]
    );
  }

  async enforceRetentionForDeployment(deploymentId: string) {
    await this.pool.query(
      `delete from deployment_logs
       where deployment_id = $1
         and id in (
           select id
           from deployment_logs
           where deployment_id = $1
           order by timestamp desc, id desc
           offset $2
         )`,
      [deploymentId, env.DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT]
    );
  }

  async isCancellationRequested(deploymentId: string) {
    const result = await this.pool.query(
      `select status, metadata
       from deployments
       where id = $1
       limit 1`,
      [deploymentId]
    );

    const row = result.rows[0] as unknown as DeploymentControlRow | undefined;
    if (!row) {
      return false;
    }

    if (row.status === 'stopped') {
      return true;
    }

    const metadata = this.normalizeMetadata(row.metadata);
    const cancellation = metadata.cancellation;
    if (!cancellation || typeof cancellation !== 'object' || Array.isArray(cancellation)) {
      return false;
    }

    const requestedAt = (cancellation as Record<string, unknown>).requestedAt;
    return typeof requestedAt === 'string' && requestedAt.length > 0;
  }

  async pruneLogsByRetentionWindow() {
    await this.pool.query(
      `delete from deployment_logs
       where timestamp < now() - ($1::int * interval '1 day')`,
      [env.DEPLOYMENT_LOG_RETENTION_DAYS]
    );
  }

  async listStuckDeployments() {
    const result = await this.pool.query(
      `select id, status
       from deployments
       where (
         status = 'queued'
         and created_at < now() - ($1::int * interval '1 minute')
       )
       or (
         status = 'building'
         and coalesce(started_at, created_at) < now() - ($2::int * interval '1 minute')
       )
       order by created_at asc
       limit 25`,
      [
        env.DEPLOYMENT_STUCK_QUEUED_MAX_AGE_MINUTES,
        env.DEPLOYMENT_STUCK_BUILDING_MAX_AGE_MINUTES
      ]
    );

    return result.rows as unknown as StuckDeploymentRow[];
  }

  async listRunningDeploymentContainers() {
    const result = await this.pool.query(
      `select d.id as deployment_id, c.container_id, p.slug as project_slug, d.runtime_url
       from deployments d
       join containers c on c.deployment_id = d.id
       join projects p on p.id = d.project_id
       where d.status = 'running'
       order by d.updated_at asc`,
      []
    );

    return result.rows as unknown as RunningContainerRow[];
  }

  async listArchivableDeploymentIds() {
    const result = await this.pool.query(
      `select d.id
       from deployments d
       where d.finished_at is not null
         and d.finished_at < now() - ($1::int * interval '1 day')
         and exists (
           select 1
           from deployment_logs l
           where l.deployment_id = d.id
         )
       order by d.finished_at asc
       limit 25`,
      [env.DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS]
    );

    const rows = result.rows as unknown as ArchiveCandidateRow[];
    return rows.map((row) => row.id);
  }

  async listDeploymentLogsByDeployment(deploymentId: string) {
    const result = await this.pool.query(
      `select id, deployment_id, level, message, timestamp
       from deployment_logs
       where deployment_id = $1
       order by timestamp asc, id asc`,
      [deploymentId]
    );

    return result.rows as unknown as DeploymentLogRow[];
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
