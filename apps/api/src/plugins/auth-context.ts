import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '../config/env.js';
import type { DbClient } from '../db/client.js';
import { apiTokens } from '../db/schema.js';
import { ALL_TOKEN_SCOPES, normalizeTokenScopes, type TokenScope } from '../modules/auth/auth-scopes.js';
import { hashApiToken } from '../modules/api-tokens/token-utils.js';
import { UnauthorizedError } from '../server/domain-errors.js';

export interface AuthContextPluginOptions {
  dbClient: DbClient;
}

export type AuthRole = 'admin' | 'user';
export type AuthSource =
  | 'database-token'
  | 'bootstrap-token'
  | 'dev-user-header'
  | 'dev-admin-token';

export interface AuthContext {
  userId: string;
  role: AuthRole;
  scopes: TokenScope[];
  authSource: AuthSource;
}

const tokenEntrySchema = z.object({
  token: z.string().min(8),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'user']).default('user'),
  scopes: z.array(z.enum(ALL_TOKEN_SCOPES)).optional()
});

const tokenEntriesSchema = z.array(tokenEntrySchema).superRefine((entries, ctx) => {
  const seenTokens = new Set<string>();

  entries.forEach((entry, index) => {
    if (seenTokens.has(entry.token)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate static token entry for token "${entry.token}"`,
        path: [index, 'token']
      });
      return;
    }

    seenTokens.add(entry.token);
  });
});

function parseBearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function parseDevUserIdHeader(value: string | string[] | undefined): string | null {
  const headerValue = Array.isArray(value) ? value[0] : value;
  if (!headerValue) {
    return null;
  }

  const parsed = z.string().uuid().safeParse(headerValue);
  return parsed.success ? parsed.data : null;
}

function createDevAuthContext(userId: string, authSource: Extract<AuthSource, 'dev-user-header' | 'dev-admin-token'>): AuthContext {
  return {
    userId,
    role: 'admin',
    scopes: ['*'],
    authSource
  };
}

function buildStaticTokenLookup() {
  const raw = env.API_TOKENS_JSON.trim();
  if (raw.length === 0) {
    return new Map<string, AuthContext>();
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error('Invalid API_TOKENS_JSON: expected a valid JSON array of token entries');
  }

  const parsed = tokenEntriesSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => issue.message)
      .join('; ');
    throw new Error(`Invalid API_TOKENS_JSON: ${details}`);
  }

  return new Map<string, AuthContext>(
    parsed.data.map((entry) => [entry.token, {
      userId: entry.userId,
      role: entry.role,
      scopes: normalizeTokenScopes(entry.scopes, entry.role),
      authSource: 'bootstrap-token'
    }])
  );
}

const authContextPluginImpl: FastifyPluginAsync<AuthContextPluginOptions> = async (app, options) => {
  const staticTokenLookup = buildStaticTokenLookup();

  async function getDbAuthContext(token: string): Promise<AuthContext | null> {
    const tokenHash = hashApiToken(token);

    const result = await options.dbClient
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
      scopes: normalizeTokenScopes(row.scopes, row.role),
      authSource: 'database-token'
    };
  }

  app.decorateRequest('auth', null);
  app.decorateRequest('authHeaderProvided', false);

  app.addHook('onRequest', async (request) => {
    request.authHeaderProvided = request.headers.authorization !== undefined;

    if (!request.url.startsWith('/v1')) {
      return;
    }

    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      if (env.ENABLE_DEV_AUTH && !request.authHeaderProvided) {
        const devUserId = parseDevUserIdHeader(request.headers['x-user-id'])
          ?? '00000000-0000-0000-0000-000000000001';

        request.auth = createDevAuthContext(devUserId, 'dev-user-header');
      }
      return;
    }

    if (env.ENABLE_DEV_AUTH && token === 'dev-admin-token') {
      request.auth = createDevAuthContext(
        '00000000-0000-0000-0000-000000000001',
        'dev-admin-token'
      );
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

export const authContextPlugin = fp(authContextPluginImpl, {
  name: 'auth-context'
});

export function requireAuthContext(request: FastifyRequest): AuthContext {
  if (!request.auth && env.ENABLE_DEV_AUTH && !request.authHeaderProvided) {
    const devUserId = parseDevUserIdHeader(request.headers['x-user-id'])
      ?? '00000000-0000-0000-0000-000000000001';

    return createDevAuthContext(devUserId, 'dev-user-header');
  }

  if (!request.auth) {
    throw new UnauthorizedError();
  }

  return request.auth;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
    authHeaderProvided: boolean;
  }
}
