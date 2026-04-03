import { createHmac, createPrivateKey, createSign, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/client.js';
import { githubInstallations } from '../../db/schema.js';

const GITHUB_API_BASE = 'https://api.github.com';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function signJwtRS256(payload: Record<string, unknown>, pemKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload))
  ];
  const signingInput = segments.join('.');
  const key = createPrivateKey(pemKey);
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(key);
  return `${signingInput}.${base64url(signature)}`;
}

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  appSlug: string;
  webhookSecret: string;
}

export interface GitHubInstallationRecord {
  id: string;
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
}

export interface GitHubRepository {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
}

export class GitHubAppService {
  constructor(
    private readonly dbClient: DbClient,
    private readonly config: GitHubAppConfig
  ) {}

  get isConfigured(): boolean {
    return (
      this.config.appId.length > 0 &&
      this.config.privateKey.length > 0 &&
      this.config.clientId.length > 0 &&
      this.config.clientSecret.length > 0
    );
  }

  getInstallUrl(state: string): string {
    return `https://github.com/apps/${this.config.appSlug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  private generateAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: this.config.appId
    };

    return signJwtRS256(payload, this.config.privateKey);
  }

  async createInstallationAccessToken(installationId: number): Promise<string> {
    const jwt = this.generateAppJwt();
    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2025-11-28'
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create installation token: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  async listInstallationRepos(installationId: number): Promise<GitHubRepository[]> {
    const token = await this.createInstallationAccessToken(installationId);
    const repos: GitHubRepository[] = [];
    let page = 1;

    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `${GITHUB_API_BASE}/installation/repositories?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2025-11-28'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list repos: ${response.status}`);
      }

      const data = (await response.json()) as {
        repositories: Array<{
          id: number;
          full_name: string;
          name: string;
          owner: { login: string };
          private: boolean;
          default_branch: string;
          clone_url: string;
        }>;
        total_count: number;
      };

      for (const repo of data.repositories) {
        repos.push({
          id: repo.id,
          fullName: repo.full_name,
          name: repo.name,
          owner: repo.owner.login,
          private: repo.private,
          defaultBranch: repo.default_branch,
          cloneUrl: repo.clone_url
        });
      }

      if (repos.length >= data.total_count) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return repos;
  }

  async handleInstallationCallback(
    userId: string,
    installationId: number
  ): Promise<GitHubInstallationRecord> {
    const jwt = this.generateAppJwt();
    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2025-11-28'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch installation: ${response.status}`);
    }

    const installation = (await response.json()) as {
      id: number;
      account: { login: string; type: string };
      permissions: Record<string, string>;
    };

    const existing = await this.dbClient
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.dbClient
        .update(githubInstallations)
        .set({
          userId,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          permissions: installation.permissions,
          updatedAt: new Date()
        })
        .where(eq(githubInstallations.installationId, installationId))
        .returning();

      return {
        id: updated.id,
        userId: updated.userId,
        installationId: updated.installationId,
        accountLogin: updated.accountLogin,
        accountType: updated.accountType
      };
    }

    const [record] = await this.dbClient
      .insert(githubInstallations)
      .values({
        userId,
        installationId: installation.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        permissions: installation.permissions
      })
      .returning();

    return {
      id: record.id,
      userId: record.userId,
      installationId: record.installationId,
      accountLogin: record.accountLogin,
      accountType: record.accountType
    };
  }

  async listUserInstallations(userId: string): Promise<GitHubInstallationRecord[]> {
    const rows = await this.dbClient
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      installationId: row.installationId,
      accountLogin: row.accountLogin,
      accountType: row.accountType
    }));
  }

  async removeInstallation(userId: string, installationId: number): Promise<void> {
    await this.dbClient
      .delete(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId));
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      return false;
    }

    const expected = 'sha256=' + createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    const sig = Buffer.from(signature);
    const exp = Buffer.from(expected);

    if (sig.length !== exp.length) {
      return false;
    }

    return timingSafeEqual(sig, exp);
  }

  async handleWebhookEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    if (event === 'installation' && payload.action === 'deleted') {
      const installation = payload.installation as { id: number } | undefined;
      if (installation?.id) {
        await this.dbClient
          .delete(githubInstallations)
          .where(eq(githubInstallations.installationId, installation.id));
      }
    }
  }

  async getInstallationForProject(githubInstallationId: number | null): Promise<string | null> {
    if (!githubInstallationId || !this.isConfigured) {
      return null;
    }

    try {
      return await this.createInstallationAccessToken(githubInstallationId);
    } catch {
      return null;
    }
  }
}
