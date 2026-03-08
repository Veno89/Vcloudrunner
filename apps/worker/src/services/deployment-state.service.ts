import { Pool } from 'pg';

import { env } from '../config/env.js';

interface SuccessInput {
  deploymentId: string;
  containerId: string;
  imageTag: string;
  internalPort: number;
  hostPort: number | null;
  runtimeUrl: string | null;
  projectId: string;
  projectSlug: string;
}

export class DeploymentStateService {
  private readonly pool = new Pool({ connectionString: env.DATABASE_URL });

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
      await this.pool.query('rollback');
      throw error;
    }
  }

  async markFailed(deploymentId: string, message: string) {
    await this.pool.query(
      `update deployments
       set status = 'failed', finished_at = now(), updated_at = now()
       where id = $1`,
      [deploymentId]
    );

    await this.pool.query(
      `insert into deployment_logs (deployment_id, level, message)
       values ($1, 'error', $2)`,
      [deploymentId, message.slice(0, 10000)]
    );
  }

  async appendLog(deploymentId: string, message: string, level = 'info') {
    await this.pool.query(
      `insert into deployment_logs (deployment_id, level, message)
       values ($1, $2, $3)`,
      [deploymentId, level, message.slice(0, 10000)]
    );
  }
}
