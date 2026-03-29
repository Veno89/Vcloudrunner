import { Client } from 'pg';

import { env } from '../config/env.js';

export type ManagedPostgresProvisioningStatus = 'pending_config' | 'ready' | 'failed';
export type ManagedPostgresHealthStatus =
  | 'unknown'
  | 'healthy'
  | 'unreachable'
  | 'credentials_invalid'
  | 'failing';

export interface ManagedPostgresRuntimeConnectionInput {
  databaseName: string;
  username: string;
  password: string;
  connectionHost: string | null;
  connectionPort: number | null;
  connectionSslMode: 'disable' | 'prefer' | 'require' | null;
}

export interface ManagedPostgresProvisioner {
  provision(input: {
    databaseName: string;
    username: string;
    password: string;
  }): Promise<{
    status: ManagedPostgresProvisioningStatus;
    statusDetail: string;
    connectionHost: string | null;
    connectionPort: number | null;
    connectionSslMode: 'disable' | 'prefer' | 'require' | null;
    provisionedAt: Date | null;
    lastErrorAt: Date | null;
  }>;
  checkHealth(input: ManagedPostgresRuntimeConnectionInput): Promise<{
    status: ManagedPostgresHealthStatus;
    statusDetail: string;
    checkedAt: Date | null;
  }>;
  rotateCredentials(input: {
    databaseName: string;
    username: string;
    previousPassword: string;
    nextPassword: string;
    connectionHost: string;
    connectionPort: number;
    connectionSslMode: 'disable' | 'prefer' | 'require';
  }): Promise<{
    status: 'rotated' | 'failed';
    statusDetail: string;
    rotatedAt: Date | null;
    lastErrorAt: Date | null;
  }>;
  deprovision(input: {
    databaseName: string;
    username: string;
  }): Promise<void>;
}

const POSTGRES_OPERATION_TIMEOUT_MS = 5_000;

function quotePgIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function quotePgLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function createPendingConfigResult(missing: string[]) {
  return {
    status: 'pending_config' as const,
    statusDetail:
      `Managed Postgres provisioning is waiting for configuration. Set ${missing.join(', ')} to enable real database creation and injected connection strings.`,
    connectionHost: null,
    connectionPort: null,
    connectionSslMode: null,
    provisionedAt: null,
    lastErrorAt: null
  };
}

function createClient(connectionString: string) {
  return new Client({
    connectionString,
    connectionTimeoutMillis: POSTGRES_OPERATION_TIMEOUT_MS,
    query_timeout: POSTGRES_OPERATION_TIMEOUT_MS
  });
}

function classifyManagedPostgresHealthFailure(error: unknown): {
  status: ManagedPostgresHealthStatus;
  detail: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null;

  if (code === '28P01' || code === '28000') {
    return {
      status: 'credentials_invalid',
      detail: `Managed Postgres rejected the generated credentials: ${message}`
    };
  }

  if (
    code === 'ECONNREFUSED'
    || code === 'ENOTFOUND'
    || code === 'EHOSTUNREACH'
    || code === 'ETIMEDOUT'
    || code === 'EAI_AGAIN'
  ) {
    return {
      status: 'unreachable',
      detail: `Managed Postgres runtime could not be reached: ${message}`
    };
  }

  return {
    status: 'failing',
    detail: `Managed Postgres health check failed: ${message}`
  };
}

async function verifyRuntimeConnection(input: ManagedPostgresRuntimeConnectionInput) {
  const connectionString = buildManagedPostgresConnectionString({
    host: input.connectionHost ?? '',
    port: input.connectionPort ?? 0,
    databaseName: input.databaseName,
    username: input.username,
    password: input.password,
    sslMode: input.connectionSslMode ?? 'prefer'
  });
  const client = createClient(connectionString);

  try {
    await client.connect();
    await client.query('select 1');
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function buildManagedPostgresConnectionString(input: {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  sslMode: 'disable' | 'prefer' | 'require';
}) {
  const url = new URL(`postgresql://${encodeURIComponent(input.username)}:${encodeURIComponent(input.password)}@${input.host}:${input.port}/${input.databaseName}`);
  url.searchParams.set('sslmode', input.sslMode);
  return url.toString();
}

class ConfiguredManagedPostgresProvisioner implements ManagedPostgresProvisioner {
  constructor(
    private readonly config: {
      adminUrl: string;
      runtimeHost: string;
      runtimePort: number;
      runtimeSslMode: 'disable' | 'prefer' | 'require';
    }
  ) {}

  private getMissingConfiguration() {
    const missing: string[] = [];

    if (this.config.adminUrl.trim().length === 0) {
      missing.push('MANAGED_POSTGRES_ADMIN_URL');
    }

    if (this.config.runtimeHost.trim().length === 0) {
      missing.push('MANAGED_POSTGRES_RUNTIME_HOST');
    }

    return missing;
  }

  private createAdminClient() {
    return createClient(this.config.adminUrl);
  }

  async provision(input: {
    databaseName: string;
    username: string;
    password: string;
  }) {
    const missing = this.getMissingConfiguration();
    if (missing.length > 0) {
      return createPendingConfigResult(missing);
    }

    const attemptedAt = new Date();
    const client = this.createAdminClient();

    try {
      await client.connect();

      const roleExists = await client.query(
        'select 1 from pg_roles where rolname = $1',
        [input.username]
      );

      if (roleExists.rowCount && roleExists.rowCount > 0) {
        await client.query(
          `alter role ${quotePgIdentifier(input.username)} with login password ${quotePgLiteral(input.password)}`
        );
      } else {
        await client.query(
          `create role ${quotePgIdentifier(input.username)} with login password ${quotePgLiteral(input.password)}`
        );
      }

      const databaseExists = await client.query(
        'select 1 from pg_database where datname = $1',
        [input.databaseName]
      );

      if (!databaseExists.rowCount || databaseExists.rowCount === 0) {
        await client.query(
          `create database ${quotePgIdentifier(input.databaseName)} owner ${quotePgIdentifier(input.username)}`
        );
      }

      return {
        status: 'ready' as const,
        statusDetail:
          'Managed Postgres is provisioned. Linked services receive generated connection variables on deploy.',
        connectionHost: this.config.runtimeHost.trim(),
        connectionPort: this.config.runtimePort,
        connectionSslMode: this.config.runtimeSslMode,
        provisionedAt: attemptedAt,
        lastErrorAt: null
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        statusDetail: `Managed Postgres provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
        connectionHost: null,
        connectionPort: null,
        connectionSslMode: null,
        provisionedAt: null,
        lastErrorAt: attemptedAt
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async checkHealth(input: ManagedPostgresRuntimeConnectionInput) {
    if (!input.connectionHost || !input.connectionPort || !input.connectionSslMode) {
      return {
        status: 'unknown' as const,
        statusDetail:
          'Runtime health checks are waiting for managed Postgres connection details. Run reconcile again after provisioning configuration is complete.',
        checkedAt: null
      };
    }

    const checkedAt = new Date();

    try {
      await verifyRuntimeConnection(input);

      return {
        status: 'healthy' as const,
        statusDetail: 'Managed Postgres accepted the generated credentials and responded to a runtime health query.',
        checkedAt
      };
    } catch (error) {
      const classified = classifyManagedPostgresHealthFailure(error);
      return {
        status: classified.status,
        statusDetail: classified.detail,
        checkedAt
      };
    }
  }

  async rotateCredentials(input: {
    databaseName: string;
    username: string;
    previousPassword: string;
    nextPassword: string;
    connectionHost: string;
    connectionPort: number;
    connectionSslMode: 'disable' | 'prefer' | 'require';
  }) {
    const missing = this.getMissingConfiguration();
    const attemptedAt = new Date();

    if (missing.length > 0) {
      return {
        status: 'failed' as const,
        statusDetail: `Managed Postgres credential rotation is waiting for configuration. Set ${missing.join(', ')} and retry.`,
        rotatedAt: null,
        lastErrorAt: attemptedAt
      };
    }

    const client = this.createAdminClient();
    let passwordWasUpdated = false;

    try {
      await client.connect();
      await client.query(
        `alter role ${quotePgIdentifier(input.username)} with login password ${quotePgLiteral(input.nextPassword)}`
      );
      passwordWasUpdated = true;

      const healthResult = await this.checkHealth({
        databaseName: input.databaseName,
        username: input.username,
        password: input.nextPassword,
        connectionHost: input.connectionHost,
        connectionPort: input.connectionPort,
        connectionSslMode: input.connectionSslMode
      });

      if (healthResult.status !== 'healthy') {
        await client.query(
          `alter role ${quotePgIdentifier(input.username)} with login password ${quotePgLiteral(input.previousPassword)}`
        );

        return {
          status: 'failed' as const,
          statusDetail: `Managed Postgres credential rotation could not be verified, so the previous password was restored. ${healthResult.statusDetail}`,
          rotatedAt: null,
          lastErrorAt: attemptedAt
        };
      }

      return {
        status: 'rotated' as const,
        statusDetail:
          'Managed Postgres credentials were rotated successfully. Redeploy linked services so they receive the new generated password.',
        rotatedAt: attemptedAt,
        lastErrorAt: null
      };
    } catch (error) {
      let detail = `Managed Postgres credential rotation failed: ${error instanceof Error ? error.message : String(error)}`;

      if (passwordWasUpdated) {
        try {
          await client.query(
            `alter role ${quotePgIdentifier(input.username)} with login password ${quotePgLiteral(input.previousPassword)}`
          );
          detail = `${detail} The previous password was restored.`;
        } catch (rollbackError) {
          detail = `${detail} The previous password could not be restored automatically: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`;
        }
      }

      return {
        status: 'failed' as const,
        statusDetail: detail,
        rotatedAt: null,
        lastErrorAt: attemptedAt
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  async deprovision(input: {
    databaseName: string;
    username: string;
  }) {
    const missing = this.getMissingConfiguration();
    if (missing.length > 0) {
      throw new Error(`Managed Postgres administration is not configured. Set ${missing.join(', ')}.`);
    }

    const client = this.createAdminClient();

    try {
      await client.connect();
      await client.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [input.databaseName]
      );
      await client.query(`drop database if exists ${quotePgIdentifier(input.databaseName)}`);
      await client.query(`drop role if exists ${quotePgIdentifier(input.username)}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

export function createConfiguredManagedPostgresProvisioner(): ManagedPostgresProvisioner {
  return new ConfiguredManagedPostgresProvisioner({
    adminUrl: env.MANAGED_POSTGRES_ADMIN_URL,
    runtimeHost: env.MANAGED_POSTGRES_RUNTIME_HOST,
    runtimePort: env.MANAGED_POSTGRES_RUNTIME_PORT,
    runtimeSslMode: env.MANAGED_POSTGRES_RUNTIME_SSL_MODE
  });
}
