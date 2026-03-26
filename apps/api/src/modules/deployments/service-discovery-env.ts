import {
  buildProjectServiceInternalHostname,
  normalizeProjectServices,
  toProjectServiceEnvToken,
  type ProjectServiceDefinition
} from '@vcloudrunner/shared-types';

function resolveServiceContainerPort(
  service: ProjectServiceDefinition,
  defaultContainerPort: number
) {
  return service.runtime?.containerPort ?? defaultContainerPort;
}

export function createProjectServiceDiscoveryEnv(input: {
  projectSlug: string;
  services: readonly ProjectServiceDefinition[];
  selectedService: ProjectServiceDefinition;
  defaultContainerPort: number;
}) {
  const services = normalizeProjectServices(input.services);
  const discoveryEnv: Record<string, string> = {
    VCLOUDRUNNER_PROJECT_SLUG: input.projectSlug,
    VCLOUDRUNNER_PROJECT_SERVICE_NAMES: services.map((service) => service.name).join(',')
  };

  for (const service of services) {
    const token = toProjectServiceEnvToken(service.name);
    const host = buildProjectServiceInternalHostname(input.projectSlug, service.name);
    const port = resolveServiceContainerPort(service, input.defaultContainerPort);
    const address = `${host}:${port}`;

    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_NAME`] = service.name;
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_KIND`] = service.kind;
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_EXPOSURE`] = service.exposure;
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_SOURCE_ROOT`] = service.sourceRoot;
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_HOST`] = host;
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_PORT`] = String(port);
    discoveryEnv[`VCLOUDRUNNER_SERVICE_${token}_ADDRESS`] = address;

    if (service.name === input.selectedService.name) {
      discoveryEnv.VCLOUDRUNNER_SERVICE_NAME = service.name;
      discoveryEnv.VCLOUDRUNNER_SERVICE_KIND = service.kind;
      discoveryEnv.VCLOUDRUNNER_SERVICE_EXPOSURE = service.exposure;
      discoveryEnv.VCLOUDRUNNER_SERVICE_SOURCE_ROOT = service.sourceRoot;
      discoveryEnv.VCLOUDRUNNER_SERVICE_HOST = host;
      discoveryEnv.VCLOUDRUNNER_SERVICE_PORT = String(port);
      discoveryEnv.VCLOUDRUNNER_SERVICE_ADDRESS = address;
    }
  }

  return discoveryEnv;
}
