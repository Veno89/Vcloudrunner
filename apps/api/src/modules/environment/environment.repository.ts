import { and, eq } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { environmentVariables } from '../../db/schema.js';

interface UpsertEnvironmentVariableInput {
  projectId: string;
  key: string;
  encryptedValue: string;
}

export class EnvironmentRepository {
  constructor(private readonly db: DbClient) {}

  async listByProject(projectId: string) {
    return this.db.query.environmentVariables.findMany({
      where: eq(environmentVariables.projectId, projectId),
      orderBy: (table, { asc }) => [asc(table.key)]
    });
  }

  async upsert(input: UpsertEnvironmentVariableInput) {
    const [record] = await this.db.insert(environmentVariables).values(input)
      .onConflictDoUpdate({
        target: [environmentVariables.projectId, environmentVariables.key],
        set: {
          encryptedValue: input.encryptedValue,
          updatedAt: new Date()
        }
      })
      .returning();

    return record;
  }

  async delete(projectId: string, key: string) {
    const [record] = await this.db.delete(environmentVariables)
      .where(and(eq(environmentVariables.projectId, projectId), eq(environmentVariables.key, key)))
      .returning();

    return record;
  }
}
