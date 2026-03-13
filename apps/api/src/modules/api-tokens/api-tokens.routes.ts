import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { ALL_TOKEN_SCOPES } from '../auth/auth-scopes.js';
import { ApiTokenNotFoundError } from '../../server/domain-errors.js';
import { assertUserAccess, requireActor, requireScope } from '../auth/auth-utils.js';
import { ApiTokensService } from './api-tokens.service.js';
import { buildTokenPreview } from './token-utils.js';

const apiTokensService = new ApiTokensService(db);

const userParamsSchema = z.object({
  userId: z.string().uuid()
});

const tokenParamsSchema = z.object({
  userId: z.string().uuid(),
  tokenId: z.string().uuid()
});

const createTokenSchema = z.object({
  role: z.enum(['admin', 'user']).default('user'),
  scopes: z.array(z.enum(ALL_TOKEN_SCOPES)).min(1).optional(),
  label: z.string().trim().min(1).max(128).optional(),
  expiresAt: z.string().datetime().optional()
});

export const apiTokensRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users/:userId/api-tokens', async (request) => {
    const actor = requireActor(request);
    const { userId } = userParamsSchema.parse(request.params);

    requireScope(actor, 'tokens:read');
    assertUserAccess(actor, userId);

    const tokens = await apiTokensService.listForUser(userId);

    return {
      data: tokens.map((token) => ({
        id: token.id,
        userId: token.userId,
        role: token.role,
        scopes: token.scopes,
        label: token.label,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        tokenPreview: buildTokenPreview(token.tokenLast4 ?? (token.token ? token.token.slice(-4) : null))
      }))
    };
  });

  app.post('/users/:userId/api-tokens', async (request, reply) => {
    const actor = requireActor(request);
    const { userId } = userParamsSchema.parse(request.params);
    const payload = createTokenSchema.parse(request.body);

    requireScope(actor, 'tokens:write');
    assertUserAccess(actor, userId);

    const created = await apiTokensService.createForUser({
      userId,
      role: payload.role,
      scopes: payload.scopes,
      label: payload.label,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
    });

    return reply.code(201).send({
      data: {
        id: created.record.id,
        userId: created.record.userId,
        role: created.record.role,
        scopes: created.record.scopes,
        label: created.record.label,
        expiresAt: created.record.expiresAt,
        revokedAt: created.record.revokedAt,
        createdAt: created.record.createdAt,
        updatedAt: created.record.updatedAt,
        token: created.token
      }
    });
  });

  app.post('/users/:userId/api-tokens/:tokenId/rotate', async (request, reply) => {
    const actor = requireActor(request);
    const { userId, tokenId } = tokenParamsSchema.parse(request.params);

    requireScope(actor, 'tokens:write');
    assertUserAccess(actor, userId);

    const rotated = await apiTokensService.rotateForUser({ tokenId, userId });
    if (!rotated) {
      throw new ApiTokenNotFoundError();
    }

    return reply.code(201).send({
      data: {
        id: rotated.record.id,
        userId: rotated.record.userId,
        role: rotated.record.role,
        scopes: rotated.record.scopes,
        label: rotated.record.label,
        expiresAt: rotated.record.expiresAt,
        revokedAt: rotated.record.revokedAt,
        createdAt: rotated.record.createdAt,
        updatedAt: rotated.record.updatedAt,
        token: rotated.token
      }
    });
  });

  app.delete('/users/:userId/api-tokens/:tokenId', async (request) => {
    const actor = requireActor(request);
    const { userId, tokenId } = tokenParamsSchema.parse(request.params);

    requireScope(actor, 'tokens:write');
    assertUserAccess(actor, userId);

    const revoked = await apiTokensService.revokeForUser({ tokenId, userId });
    if (!revoked) {
      throw new ApiTokenNotFoundError();
    }

    return {
      data: {
        id: revoked.id,
        revokedAt: revoked.revokedAt,
        updatedAt: revoked.updatedAt
      }
    };
  });
};
