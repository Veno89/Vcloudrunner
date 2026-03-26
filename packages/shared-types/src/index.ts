export type DeploymentStatus = 'queued' | 'building' | 'running' | 'failed' | 'stopped';

export type ProjectServiceKind = 'web' | 'worker';

export type ProjectServiceExposure = 'public' | 'internal';

export interface ProjectServiceRuntimeOverrides {
  containerPort?: number;
  memoryMb?: number;
  cpuMillicores?: number;
}

export interface ProjectServiceDefinition {
  name: string;
  kind: ProjectServiceKind;
  sourceRoot: string;
  exposure: ProjectServiceExposure;
  runtime?: ProjectServiceRuntimeOverrides;
}

export interface ProjectServiceTarget {
  kind?: ProjectServiceKind;
  exposure?: ProjectServiceExposure;
}

export const DEFAULT_PROJECT_SERVICE_NAME = 'app';

function hashServiceIdentity(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createDefaultProjectServices(): ProjectServiceDefinition[] {
  return [
    {
      name: DEFAULT_PROJECT_SERVICE_NAME,
      kind: 'web',
      sourceRoot: '.',
      exposure: 'public'
    }
  ];
}

export function normalizeProjectServices(
  services?: readonly ProjectServiceDefinition[] | null
): ProjectServiceDefinition[] {
  const source = services && services.length > 0 ? services : createDefaultProjectServices();

  return source.map((service) => ({
    ...service,
    ...(service.runtime ? { runtime: { ...service.runtime } } : {})
  }));
}

export function getPrimaryProjectService(
  services?: readonly ProjectServiceDefinition[] | null
): ProjectServiceDefinition {
  const normalizedServices = normalizeProjectServices(services);

  return normalizedServices.find((service) => service.exposure === 'public')
    ?? normalizedServices[0]!;
}

export function getProjectServiceByName(
  services: readonly ProjectServiceDefinition[] | null | undefined,
  serviceName: string
): ProjectServiceDefinition | null {
  const normalizedServices = normalizeProjectServices(services);

  return normalizedServices.find((service) => service.name === serviceName) ?? null;
}

export function resolveProjectService(
  services?: readonly ProjectServiceDefinition[] | null,
  serviceName?: string | null
): ProjectServiceDefinition | null {
  if (serviceName && serviceName.length > 0) {
    return getProjectServiceByName(services, serviceName);
  }

  return getPrimaryProjectService(services);
}

export function isPublicWebServiceTarget(service?: ProjectServiceTarget | null): boolean {
  return (service?.kind ?? 'web') === 'web' && (service?.exposure ?? 'public') === 'public';
}

export function toProjectServiceEnvToken(serviceName: string): string {
  return serviceName.replace(/-/g, '_').toUpperCase();
}

export function buildProjectServiceInternalHostname(
  projectSlug: string,
  serviceName: string
): string {
  const base = `svc-${projectSlug}-${serviceName}`;
  if (base.length <= 63) {
    return base;
  }

  const hash = hashServiceIdentity(`${projectSlug}:${serviceName}`);
  const truncatedProjectSlug = projectSlug.slice(0, 24).replace(/-+$/g, '') || 'project';
  const truncatedServiceName = serviceName.slice(0, 24).replace(/-+$/g, '') || 'service';

  return `svc-${truncatedProjectSlug}-${truncatedServiceName}-${hash}`;
}

export interface ProjectDto {
  id: string;
  userId: string;
  name: string;
  slug: string;
  gitRepositoryUrl: string;
  defaultBranch: string;
  services: ProjectServiceDefinition[];
  createdAt: string;
  updatedAt: string;
}

export const QUEUE_NAMES = {
  deployment: 'deployment-jobs'
} as const;

export interface DeploymentRuntimeConfig {
  containerPort: number;
  memoryMb: number;
  cpuMillicores: number;
}

export interface DeploymentJobPayload {
  deploymentId: string;
  projectId: string;
  projectSlug: string;
  correlationId?: string;
  gitRepositoryUrl: string;
  branch: string;
  commitSha?: string;
  serviceName?: string;
  serviceKind?: ProjectServiceKind;
  serviceSourceRoot?: string;
  serviceExposure?: ProjectServiceExposure;
  env: Record<string, string>;
  runtime: DeploymentRuntimeConfig;
}
