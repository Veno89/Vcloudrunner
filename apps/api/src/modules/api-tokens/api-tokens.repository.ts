import { and, desc, eq, isNull } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { apiTokens } from '../../db/schema.js';

export interface CreateApiTokenInput {
  userId: string;
  tokenHash: string;
  tokenLast4: string;
  role: 'admin' | 'user';
  scopes: string[];
  label?: string;
  expiresAt?: Date | null;
}

export class ApiTokensRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateApiTokenInput) {
    const [record] = await this.db.insert(apiTokens).values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      tokenLast4: input.tokenLast4,
      role: input.role,
      scopes: input.scopes,
      label: input.label ?? null,
      expiresAt: input.expiresAt ?? null
    }).returning();

    return record;
  }

  async listForUser(userId: string) {
    return this.db.query.apiTokens.findMany({
      where: eq(apiTokens.userId, userId),
      orderBy: [desc(apiTokens.createdAt)]
    });
  }

  async revokeByIdForUser(id: string, userId: string) {
    const [record] = await this.db
      .update(apiTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
      .returning();

    return record ?? null;
  }

  async findActiveByIdForUser(id: string, userId: string) {
    return this.db.query.apiTokens.findFirst({
      where: and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt))
    });
  }

  async findActiveByHash(tokenHash: string) {
    return this.db.query.apiTokens.findFirst({
      where: and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt))
    });
  }
}
