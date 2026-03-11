import { randomBytes } from 'node:crypto';

import type { DbClient } from '../../db/client.js';
import { ApiTokensRepository } from './api-tokens.repository.js';

interface CreateTokenInput {
  userId: string;
  role: 'admin' | 'user';
  label?: string;
  expiresAt?: Date | null;
}

export class ApiTokensService {
  private readonly repository: ApiTokensRepository;

  constructor(db: DbClient) {
    this.repository = new ApiTokensRepository(db);
  }

  async createForUser(input: CreateTokenInput) {
    const plaintextToken = randomBytes(32).toString('hex');

    const created = await this.repository.create({
      ...input,
      token: plaintextToken
    });

    return {
      token: plaintextToken,
      record: created
    };
  }

  async listForUser(userId: string) {
    return this.repository.listForUser(userId);
  }

  async revokeForUser(input: { tokenId: string; userId: string }) {
    return this.repository.revokeByIdForUser(input.tokenId, input.userId);
  }
}
