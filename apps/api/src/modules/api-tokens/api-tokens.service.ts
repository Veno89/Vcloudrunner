import { randomBytes } from 'node:crypto';

import type { DbClient } from '../../db/client.js';
import { normalizeTokenScopes, type TokenScope } from '../auth/auth-scopes.js';
import { ApiTokensRepository } from './api-tokens.repository.js';
import { getTokenLast4, hashApiToken } from './token-utils.js';

interface CreateTokenInput {
  userId: string;
  role: 'admin' | 'user';
  scopes?: TokenScope[];
  label?: string;
  expiresAt?: Date | null;
}

interface RotateTokenInput {
  tokenId: string;
  userId: string;
}

export class ApiTokensService {
  private readonly repository: ApiTokensRepository;

  constructor(db: DbClient) {
    this.repository = new ApiTokensRepository(db);
  }

  async createForUser(input: CreateTokenInput) {
    const plaintextToken = randomBytes(32).toString('hex');
    const tokenHash = hashApiToken(plaintextToken);
    const tokenLast4 = getTokenLast4(plaintextToken);
    const scopes = normalizeTokenScopes(input.scopes, input.role);

    const created = await this.repository.create({
      ...input,
      tokenHash,
      tokenLast4,
      scopes
    });

    return {
      token: plaintextToken,
      record: created
    };
  }

  async listForUser(userId: string) {
    return this.repository.listForUser(userId);
  }

  async revokeForUser(
    input: { tokenId: string; userId: string }
  ): Promise<Awaited<ReturnType<ApiTokensRepository['revokeByIdForUser']>>> {
    return this.repository.revokeByIdForUser(input.tokenId, input.userId);
  }

  async rotateForUser(input: RotateTokenInput) {
    const existing = await this.repository.findActiveByIdForUser(input.tokenId, input.userId);
    if (!existing) {
      return null;
    }

    await this.repository.revokeByIdForUser(existing.id, input.userId);

    const created = await this.createForUser({
      userId: existing.userId,
      role: existing.role === 'admin' ? 'admin' : 'user',
      scopes: normalizeTokenScopes(existing.scopes, existing.role === 'admin' ? 'admin' : 'user'),
      label: existing.label ?? undefined,
      expiresAt: existing.expiresAt
    });

    return created;
  }
}
