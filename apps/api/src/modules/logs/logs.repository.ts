import { and, asc, eq, gt, sql } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { deploymentLogs } from '../../db/schema.js';

interface ListLogsInput {
  deploymentId: string;
  after?: string;
  limit: number;
}

interface ExportLogsInput {
  deploymentId: string;
  from?: string;
  to?: string;
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

  async listForExport(input: ExportLogsInput) {
    let whereClause = eq(deploymentLogs.deploymentId, input.deploymentId);

    if (input.from) {
      whereClause = and(whereClause, gt(deploymentLogs.timestamp, sql`${input.from}::timestamptz`))!;
    }

    if (input.to) {
      whereClause = and(whereClause, sql`${deploymentLogs.timestamp} <= ${input.to}::timestamptz`)!;
    }

    return this.db.query.deploymentLogs.findMany({
      where: whereClause,
      orderBy: [asc(deploymentLogs.timestamp), asc(deploymentLogs.id)]
    });
  }
}
