import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { apiTokens } from '../db/schema.js';
import { ALL_TOKEN_SCOPES, normalizeTokenScopes, type TokenScope } from '../modules/auth/auth-scopes.js';
import { hashApiToken } from '../modules/api-tokens/token-utils.js';
import { UnauthorizedError } from '../server/domain-errors.js';

export type AuthRole = 'admin' | 'user';

interface AuthContext {
  userId: string;
  role: AuthRole;
  scopes: TokenScope[];
}

const tokenEntrySchema = z.object({
  token: z.string().min(8),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'user']).default('user'),
  scopes: z.array(z.enum(ALL_TOKEN_SCOPES)).optional()
});

const tokenEntriesSchema = z.array(tokenEntrySchema);

function parseBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function buildStaticTokenLookup() {
  const raw = env.API_TOKENS_JSON.trim();
  if (raw.length === 0) {
    return new Map<string, AuthContext>();
  }

  const parsed = tokenEntriesSchema.parse(JSON.parse(raw));
  return new Map<string, AuthContext>(
    parsed.map((entry) => [entry.token, {
      userId: entry.userId,
      role: entry.role,
      scopes: normalizeTokenScopes(entry.scopes, entry.role)
    }])
  );
}

async function getDbAuthContext(token: string): Promise<AuthContext | null> {
  const tokenHash = hashApiToken(token);

  const result = await db
    .select({ userId: apiTokens.userId, role: apiTokens.role, scopes: apiTokens.scopes })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, tokenHash),
        isNull(apiTokens.revokedAt),
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date()))
      )
    )
    .limit(1);

  const row = result[0];
  if (!row) {
    return null;
  }

  if (row.role !== 'admin' && row.role !== 'user') {
    return null;
  }

  return {
    userId: row.userId,
    role: row.role,
    scopes: normalizeTokenScopes(row.scopes, row.role)
  };
}

export const authContextPlugin: FastifyPluginAsync = async (app) => {
  const staticTokenLookup = buildStaticTokenLookup();

  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/v1')) {
      return;
    }

    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      return;
    }

    if (env.ENABLE_DEV_AUTH && token === 'dev-admin-token') {
      request.auth = {
        userId: '00000000-0000-0000-0000-000000000001',
        role: 'admin',
        scopes: ['*']
      };
      return;
    }

    const dbAuth = await getDbAuthContext(token);
    if (dbAuth) {
      request.auth = dbAuth;
      return;
    }

    const staticAuth = staticTokenLookup.get(token);
    if (staticAuth) {
      request.auth = staticAuth;
    }
  });
};

export function requireAuthContext(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new UnauthorizedError();
  }

  return request.auth;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
