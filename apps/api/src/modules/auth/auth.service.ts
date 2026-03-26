import { eq } from 'drizzle-orm';

import type { DbClient } from '../../db/client.js';
import { users } from '../../db/schema.js';
import type { AuthContext } from '../../plugins/auth-context.js';

export interface AuthViewer {
  userId: string;
  role: AuthContext['role'];
  scopes: AuthContext['scopes'];
  authSource: AuthContext['authSource'];
  authMode: 'token' | 'development';
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

function getAuthMode(authSource: AuthContext['authSource']): AuthViewer['authMode'] {
  return authSource === 'database-token' || authSource === 'bootstrap-token'
    ? 'token'
    : 'development';
}

export class AuthService {
  constructor(private readonly dbClient: DbClient) {}

  async getViewer(actor: AuthContext): Promise<AuthViewer> {
    const result = await this.dbClient
      .select({
        id: users.id,
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);

    const user = result[0] ?? null;

    return {
      userId: actor.userId,
      role: actor.role,
      scopes: actor.scopes,
      authSource: actor.authSource,
      authMode: getAuthMode(actor.authSource),
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email
          }
        : null
    };
  }
}
