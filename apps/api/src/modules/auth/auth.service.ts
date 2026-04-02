import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

import type { DbClient } from '../../db/client.js';
import { apiTokens, projectInvitations, projectMembers, projects, users } from '../../db/schema.js';
import type { AuthContext } from '../../plugins/auth-context.js';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  UserEmailTakenError
} from '../../server/domain-errors.js';
import { normalizeTokenScopes } from '../auth/auth-scopes.js';
import { getTokenLast4, hashApiToken } from '../api-tokens/token-utils.js';
import { hashPassword, verifyPassword } from './password-utils.js';

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
  acceptedProjectInvitations?: Array<{
    projectId: string;
    projectName: string;
    role: 'viewer' | 'editor' | 'admin';
  }>;
}

export interface UpsertViewerProfileInput {
  name: string;
  email: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthSessionResult {
  token: string;
  viewer: AuthViewer;
}

interface PostgresError {
  code?: string;
  constraint?: string;
}

const SESSION_TOKEN_EXPIRY_DAYS = 30;
const SESSION_TOKEN_LABEL = 'Dashboard session';

function getAuthMode(authSource: AuthContext['authSource']): AuthViewer['authMode'] {
  return authSource === 'database-token' || authSource === 'bootstrap-token'
    ? 'token'
    : 'development';
}

function toViewerUser(
  user: {
    id: string;
    name: string;
    email: string;
  } | null
): AuthViewer['user'] {
  return user
    ? {
        id: user.id,
        name: user.name,
        email: user.email
      }
    : null;
}

function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function buildViewer(
  actor: AuthContext,
  user: AuthViewer['user'],
  acceptedProjectInvitations?: AuthViewer['acceptedProjectInvitations']
): AuthViewer {
  return {
    userId: actor.userId,
    role: actor.role,
    scopes: actor.scopes,
    authSource: actor.authSource,
    authMode: getAuthMode(actor.authSource),
    user,
    ...(acceptedProjectInvitations && acceptedProjectInvitations.length > 0
      ? { acceptedProjectInvitations }
      : {})
  };
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

    const user = toViewerUser(result[0] ?? null);

    return buildViewer(actor, user);
  }

  async upsertViewerProfile(
    actor: AuthContext,
    input: UpsertViewerProfileInput
  ): Promise<AuthViewer> {
    try {
      const normalizedEmail = normalizeEmailAddress(input.email);

      return await this.dbClient.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            id: actor.userId,
            name: input.name,
            email: normalizedEmail
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              name: input.name,
              email: normalizedEmail,
              updatedAt: new Date()
            }
          })
          .returning();

        const pendingInvitations = await tx
          .select({
            id: projectInvitations.id,
            projectId: projectInvitations.projectId,
            role: projectInvitations.role,
            invitedBy: projectInvitations.invitedBy,
            projectName: projects.name
          })
          .from(projectInvitations)
          .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
          .where(and(
            eq(projectInvitations.email, normalizedEmail),
            eq(projectInvitations.status, 'pending')
          ));

        const acceptedProjectInvitations: NonNullable<AuthViewer['acceptedProjectInvitations']> = [];

        for (const invitation of pendingInvitations) {
          const existingMembership = await tx
            .select({ id: projectMembers.id })
            .from(projectMembers)
            .where(and(
              eq(projectMembers.projectId, invitation.projectId),
              eq(projectMembers.userId, actor.userId)
            ))
            .limit(1);

          if (existingMembership.length === 0) {
            await tx.insert(projectMembers).values({
              projectId: invitation.projectId,
              userId: actor.userId,
              role: invitation.role,
              invitedBy: invitation.invitedBy
            });

            acceptedProjectInvitations.push({
              projectId: invitation.projectId,
              projectName: invitation.projectName,
              role: invitation.role
            });
          }

          await tx
            .update(projectInvitations)
            .set({
              status: 'accepted',
              acceptedByUserId: actor.userId,
              acceptedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(projectInvitations.id, invitation.id));
        }

        return buildViewer(
          actor,
          toViewerUser(user ?? null),
          acceptedProjectInvitations
        );
      });
    } catch (error) {
      const pgError = error as PostgresError;
      if (pgError.code === '23505' && pgError.constraint === 'users_email_unique') {
        throw new UserEmailTakenError();
      }

      throw error;
    }
  }

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    const normalizedEmail = normalizeEmailAddress(input.email);
    const passwordHash = await hashPassword(input.password);

    try {
      const [user] = await this.dbClient
        .insert(users)
        .values({
          email: normalizedEmail,
          name: input.name,
          passwordHash
        })
        .returning();

      const sessionToken = await this.createSessionToken(user.id);

      const actor: AuthContext = {
        userId: user.id,
        role: 'user',
        scopes: normalizeTokenScopes(undefined, 'user'),
        authSource: 'database-token'
      };

      return {
        token: sessionToken,
        viewer: buildViewer(actor, toViewerUser(user))
      };
    } catch (error) {
      const pgError = error as PostgresError;
      if (pgError.code === '23505' && pgError.constraint === 'users_email_unique') {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const normalizedEmail = normalizeEmailAddress(input.email);

    const result = await this.dbClient
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = result[0];
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const sessionToken = await this.createSessionToken(user.id);

    const actor: AuthContext = {
      userId: user.id,
      role: 'user',
      scopes: normalizeTokenScopes(undefined, 'user'),
      authSource: 'database-token'
    };

    return {
      token: sessionToken,
      viewer: buildViewer(actor, toViewerUser(user))
    };
  }

  async changePassword(actor: AuthContext, input: ChangePasswordInput): Promise<void> {
    const result = await this.dbClient
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);

    const user = result[0];
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const newHash = await hashPassword(input.newPassword);

    await this.dbClient
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, actor.userId));
  }

  private async createSessionToken(userId: string): Promise<string> {
    const plaintextToken = randomBytes(32).toString('hex');
    const tokenHash = hashApiToken(plaintextToken);
    const tokenLast4 = getTokenLast4(plaintextToken);
    const scopes = normalizeTokenScopes(undefined, 'user');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_TOKEN_EXPIRY_DAYS);

    await this.dbClient.insert(apiTokens).values({
      userId,
      tokenHash,
      tokenLast4,
      role: 'user',
      scopes,
      label: SESSION_TOKEN_LABEL,
      expiresAt
    });

    return plaintextToken;
  }
}
