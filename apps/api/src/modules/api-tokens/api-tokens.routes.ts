import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/client.js';
import { assertUserAccess, requireActor } from '../auth/auth-utils.js';
import { ApiTokensService } from './api-tokens.service.js';

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
  label: z.string().trim().min(1).max(128).optional(),
  expiresAt: z.string().datetime().optional()
});

export const apiTokensRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users/:userId/api-tokens', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { userId } = userParamsSchema.parse(request.params);

      try {
        assertUserAccess(actor, userId);
      } catch {
        return reply.forbidden('Cannot list API tokens for another user');
      }

      const tokens = await apiTokensService.listForUser(userId);

      return {
        data: tokens.map((token) => ({
          id: token.id,
          userId: token.userId,
          role: token.role,
          label: token.label,
          expiresAt: token.expiresAt,
          revokedAt: token.revokedAt,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
          tokenPreview: `${token.token.slice(0, 6)}...${token.token.slice(-4)}`
        }))
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }

      throw error;
    }
  });

  app.post('/users/:userId/api-tokens', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { userId } = userParamsSchema.parse(request.params);
      const payload = createTokenSchema.parse(request.body);

      try {
        assertUserAccess(actor, userId);
      } catch {
        return reply.forbidden('Cannot create API tokens for another user');
      }

      const created = await apiTokensService.createForUser({
        userId,
        role: payload.role,
        label: payload.label,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      });

      return reply.code(201).send({
        data: {
          id: created.record.id,
          userId: created.record.userId,
          role: created.record.role,
          label: created.record.label,
          expiresAt: created.record.expiresAt,
          revokedAt: created.record.revokedAt,
          createdAt: created.record.createdAt,
          updatedAt: created.record.updatedAt,
          token: created.token
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }

      throw error;
    }
  });

  app.delete('/users/:userId/api-tokens/:tokenId', async (request, reply) => {
    try {
      const actor = requireActor(request);
      const { userId, tokenId } = tokenParamsSchema.parse(request.params);

      try {
        assertUserAccess(actor, userId);
      } catch {
        return reply.forbidden('Cannot revoke API tokens for another user');
      }

      const revoked = await apiTokensService.revokeForUser({ tokenId, userId });
      if (!revoked) {
        return reply.notFound('API token not found or already revoked');
      }

      return {
        data: {
          id: revoked.id,
          revokedAt: revoked.revokedAt,
          updatedAt: revoked.updatedAt
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return reply.unauthorized('Missing or invalid Bearer token');
      }

      throw error;
    }
  });
};
