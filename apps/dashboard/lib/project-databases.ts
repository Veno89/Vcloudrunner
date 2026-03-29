import type { ApiProjectDatabase } from './api';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

export function getProjectDatabaseStatusBadge(status: ApiProjectDatabase['status']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (status) {
    case 'ready':
      return {
        label: 'Provisioned',
        variant: 'success'
      };
    case 'provisioning':
      return {
        label: 'Provisioning',
        variant: 'info'
      };
    case 'failed':
      return {
        label: 'Provisioning Failed',
        variant: 'destructive'
      };
    case 'pending_config':
    default:
      return {
        label: 'Needs Config',
        variant: 'warning'
      };
  }
}

export function getProjectDatabaseHealthBadge(healthStatus: ApiProjectDatabase['healthStatus']): {
  label: string;
  variant: BadgeVariant;
} {
  switch (healthStatus) {
    case 'healthy':
      return {
        label: 'Healthy',
        variant: 'success'
      };
    case 'unreachable':
      return {
        label: 'Runtime Unreachable',
        variant: 'destructive'
      };
    case 'credentials_invalid':
      return {
        label: 'Credentials Rejected',
        variant: 'destructive'
      };
    case 'failing':
      return {
        label: 'Health Query Failed',
        variant: 'warning'
      };
    case 'unknown':
    default:
      return {
        label: 'Health Unknown',
        variant: 'outline'
      };
  }
}

export function summarizeProjectDatabases(input: {
  databases: ApiProjectDatabase[];
  databasesUnavailable?: boolean;
}): {
  label: string;
  variant: BadgeVariant;
  detail: string;
} {
  if (input.databasesUnavailable) {
    return {
      label: 'Unavailable',
      variant: 'warning' as const,
      detail: 'Managed database data could not be loaded for this project.'
    };
  }

  if (input.databases.length === 0) {
    return {
      label: 'None',
      variant: 'outline' as const,
      detail: 'No managed databases are configured for this project yet.'
    };
  }

  const failedProvisioningCount = input.databases.filter((database) => database.status === 'failed').length;
  const pendingConfigCount = input.databases.filter((database) => database.status === 'pending_config').length;
  const unhealthyCount = input.databases.filter((database) =>
    database.status === 'ready' && database.healthStatus !== 'healthy'
  ).length;
  const readyCount = input.databases.filter((database) => database.status === 'ready').length;

  return {
    label: `${input.databases.length} configured`,
    variant:
      failedProvisioningCount > 0 || unhealthyCount > 0
        ? 'destructive'
        : pendingConfigCount > 0
          ? 'warning'
          : readyCount === input.databases.length
            ? 'success'
            : 'info',
    detail:
      failedProvisioningCount > 0
        ? `${failedProvisioningCount} managed database${failedProvisioningCount === 1 ? '' : 's'} still have provisioning failures.`
        : unhealthyCount > 0
          ? `${unhealthyCount} ready managed database${unhealthyCount === 1 ? '' : 's'} need runtime follow-up.`
          : pendingConfigCount > 0
            ? `${pendingConfigCount} managed database${pendingConfigCount === 1 ? '' : 's'} still need platform provisioning configuration.`
            : 'All managed databases are provisioned and currently passing runtime health checks.'
  };
}

export function describeProjectDatabaseServiceLinks(database: ApiProjectDatabase) {
  if (database.serviceNames.length === 0) {
    return 'No linked services yet. This database will not inject credentials into deployments until at least one service is linked.';
  }

  if (database.serviceNames.length === 1) {
    return `Injected into ${database.serviceNames[0]} deployments via generated environment variables.`;
  }

  return `Injected into ${database.serviceNames.join(', ')} deployments via generated environment variables.`;
}
