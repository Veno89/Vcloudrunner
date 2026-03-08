import { and, asc, eq, gt, sql } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { deploymentLogs } from '../../db/schema.js';

interface ListLogsInput {
  deploymentId: string;
  after?: string;
  limit: number;
}

export class LogsRepository {
  constructor(private readonly db: DbClient) {}

  async listByDeployment(input: ListLogsInput) {
    const whereClause = input.after
      ? and(
        eq(deploymentLogs.deploymentId, input.deploymentId),
        gt(deploymentLogs.timestamp, sql`${input.after}::timestamptz`)
      )
      : eq(deploymentLogs.deploymentId, input.deploymentId);

    return this.db.query.deploymentLogs.findMany({
      where: whereClause,
      orderBy: [asc(deploymentLogs.timestamp)],
      limit: input.limit
    });
  }
}
