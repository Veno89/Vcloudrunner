import {
  isPublicWebServiceTarget,
  normalizeProjectServices,
  resolveProjectService,
  type DeploymentJobPayload,
  type DeploymentRuntimeConfig
} from '@vcloudrunner/shared-types';

import { env } from '../../config/env.js';
import type { DbClient } from '../../db/client.js';
import { DeploymentQueue } from '../../queue/deployment-queue.js';
import {
  DeploymentAlreadyActiveError,
  DeploymentCancellationNotAllowedError,
  DeploymentNotFoundError,
  DeploymentQueueUnavailableError,
  InvalidProjectServiceError,
  ProjectNotFoundError
} from '../../server/domain-errors.js';
import { CryptoService } from '../../services/crypto.service.js';
import { EnvironmentRepository } from '../environment/environment.repository.js';
import type { ProjectDatabasesService } from '../project-databases/project-databases.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { DeploymentsRepository, type CreateDeploymentInput } from './deployments.repository.js';
import { createProjectServiceDiscoveryEnv } from './service-discovery-env.js';


const SINGLE_ACTIVE_DEPLOYMENT_INDEX = 'deployments_project_service_single_active_idx';

const DEPLOYMENTS_PROJECT_FK_CONSTRAINT = 'deployments_project_id_projects_id_fk';

function isPostgresConstraintViolation(input: {
  error: unknown;
  code: '23503' | '23505';
  constraint: string;
  table?: string;
}) {
  if (!input.error || typeof input.error !== 'object') {
    return false;
  }

  const maybeError = input.error as { code?: unknown; constraint?: unknown; table?: unknown };
  return (
    maybeError.code === input.code
    && maybeError.constraint === input.constraint
    && (input.table === undefined || maybeError.table === undefined || maybeError.table === input.table)
  );
}

function isProjectForeignKeyViolation(error: unknown) {
  return isPostgresConstraintViolation({
    error,
    code: '23503',
    constraint: DEPLOYMENTS_PROJECT_FK_CONSTRAINT,
    table: 'deployments'
  });
}

function isSingleActiveDeploymentUniqueViolation(error: unknown) {
  return isPostgresConstraintViolation({
    error,
    code: '23505',
    constraint: SINGLE_ACTIVE_DEPLOYMENT_INDEX,
    table: 'deployments'
  });
}

function createDefaultProjectDomainHost(projectSlug: string) {
  return `${projectSlug}.${env.PLATFORM_DOMAIN}`;
}

function buildPublicRouteHosts(input: {
  projectSlug: string;
  claimedHosts: readonly string[];
}) {
  const defaultHost = createDefaultProjectDomainHost(input.projectSlug);
  const hosts = [defaultHost];

  for (const host of input.claimedHosts) {
    if (host !== defaultHost) {
      hosts.push(host);
    }
  }

  return hosts;
}

interface DeploymentsServiceDependencies {
  deploymentsRepository?: DeploymentsRepository;
  projectsRepository?: ProjectsRepository;
  environmentRepository?: EnvironmentRepository;
  cryptoService?: CryptoService;
  projectDatabasesService?: Pick<ProjectDatabasesService, 'listInjectedEnvironmentForProjectService'>;
}

export class DeploymentsService {
  private readonly deploymentsRepository: DeploymentsRepository;
  private readonly projectsRepository: ProjectsRepository;
  private readonly environmentRepository: EnvironmentRepository;
  private readonly cryptoService: CryptoService;
  private readonly projectDatabasesService: Pick<ProjectDatabasesService, 'listInjectedEnvironmentForProjectService'>;

  constructor(
    db: DbClient,
    private readonly deploymentQueue: DeploymentQueue,
    dependencies: DeploymentsServiceDependencies = {}
  ) {
    this.deploymentsRepository = dependencies.deploymentsRepository ?? new DeploymentsRepository(db);
    this.projectsRepository = dependencies.projectsRepository ?? new ProjectsRepository(db);
    this.environmentRepository = dependencies.environmentRepository ?? new EnvironmentRepository(db);
    this.cryptoService = dependencies.cryptoService ?? new CryptoService();
    this.projectDatabasesService = dependencies.projectDatabasesService ?? {
      listInjectedEnvironmentForProjectService: async () => ({})
    };
  }

  async createDeployment(input: CreateDeploymentInput & { correlationId: string }) {
    const project = await this.projectsRepository.findById(input.projectId);
    if (!project) {
      throw new ProjectNotFoundError();
    }

    const services = normalizeProjectServices(project.services);
    const selectedService = resolveProjectService(services, input.serviceName);
    if (!selectedService) {
      throw new InvalidProjectServiceError(input.serviceName ?? 'unknown');
    }

    const runtime: DeploymentRuntimeConfig = {
      containerPort:
        input.runtime?.containerPort
        ?? selectedService.runtime?.containerPort
        ?? env.DEPLOYMENT_DEFAULT_CONTAINER_PORT,
      memoryMb:
        input.runtime?.memoryMb
        ?? selectedService.runtime?.memoryMb
        ?? env.DEPLOYMENT_DEFAULT_MEMORY_MB,
      cpuMillicores:
        input.runtime?.cpuMillicores
        ?? selectedService.runtime?.cpuMillicores
        ?? env.DEPLOYMENT_DEFAULT_CPU_MILLICORES
    };

    let deployment;
    try {
      deployment = await this.deploymentsRepository.createIfNoActiveDeployment({
        ...input,
        serviceName: selectedService.name,
        metadata: {
          ...(input.metadata ?? {}),
          runtime,
          service: {
            name: selectedService.name,
            kind: selectedService.kind,
            sourceRoot: selectedService.sourceRoot,
            exposure: selectedService.exposure
          },
          services
        }
      });
    } catch (error) {
      if (isSingleActiveDeploymentUniqueViolation(error)) {
        throw new DeploymentAlreadyActiveError(selectedService.name);
      }

      if (isProjectForeignKeyViolation(error)) {
        throw new ProjectNotFoundError();
      }

      throw error;
    }

    if (!deployment) {
      throw new DeploymentAlreadyActiveError(selectedService.name);
    }

    let payload: DeploymentJobPayload;
    try {
      const envVars = await this.environmentRepository.listByProject(project.id);
      const decryptedEnv = Object.fromEntries(
        envVars.map((item) => [item.key, this.cryptoService.decrypt(item.encryptedValue)])
      );
      const claimedHosts = await this.projectsRepository.listDomains(project.id);
      const managedDatabaseEnv = await this.projectDatabasesService.listInjectedEnvironmentForProjectService({
        projectId: project.id,
        serviceName: selectedService.name
      });
      const discoveryEnv = createProjectServiceDiscoveryEnv({
        projectSlug: project.slug,
        services,
        selectedService,
        defaultContainerPort: env.DEPLOYMENT_DEFAULT_CONTAINER_PORT
      });
      const publicRouteHosts = isPublicWebServiceTarget(selectedService)
        ? buildPublicRouteHosts({
            projectSlug: project.slug,
            claimedHosts: claimedHosts.map((domain) => domain.host)
          })
        : [];

      payload = {
        deploymentId: deployment.id,
        projectId: project.id,
        projectSlug: project.slug,
        correlationId: input.correlationId,
        gitRepositoryUrl: project.gitRepositoryUrl,
        branch: input.branch ?? project.defaultBranch,
        commitSha: input.commitSha,
        serviceName: selectedService.name,
        serviceKind: selectedService.kind,
        serviceSourceRoot: selectedService.sourceRoot,
        serviceExposure: selectedService.exposure,
        publicRouteHosts,
        env: {
          ...decryptedEnv,
          ...managedDatabaseEnv,
          ...discoveryEnv
        },
        runtime
      };
    } catch (error) {
      await this.markFailedBestEffort(deployment.id, 'DEPLOYMENT_ENV_RESOLUTION_FAILED', error);
      throw error;
    }

    try {
      const job = await this.deploymentQueue.enqueue(payload);

      return {
        ...deployment,
        queueJobId: job.id
      };
    } catch (error) {
      await this.markFailedBestEffort(deployment.id, 'DEPLOYMENT_QUEUE_ENQUEUE_FAILED', error);

      throw new DeploymentQueueUnavailableError();
    }
  }

  listDeployments(projectId: string) {
    return this.deploymentsRepository.findByProject(projectId);
  }

  async cancelDeployment(input: {
    projectId: string;
    deploymentId: string;
    correlationId: string;
  }) {
    const deployment = await this.deploymentsRepository.findById(input.projectId, input.deploymentId);
    if (!deployment) {
      throw new DeploymentNotFoundError();
    }

    if (deployment.status === 'failed' || deployment.status === 'stopped' || deployment.status === 'running') {
      throw new DeploymentCancellationNotAllowedError(deployment.status);
    }

    const metadata = this.normalizeMetadata(deployment.metadata);
    await this.deploymentsRepository.markCancellationRequested({
      deploymentId: deployment.id,
      metadata,
      requestedByCorrelationId: input.correlationId
    });

    if (deployment.status === 'queued') {
      let removed = false;

      try {
        removed = await this.deploymentQueue.cancelQueuedDeployment(deployment.id);
      } catch {
        removed = false;
      }

      if (removed) {
        try {
          await this.deploymentsRepository.markStopped(deployment.id);
        } catch (error) {
          await this.markFailedBestEffort(deployment.id, 'DEPLOYMENT_CANCEL_FINALIZATION_FAILED', error);
          throw error;
        }

        await this.appendLogBestEffort({
          deploymentId: deployment.id,
          level: 'warn',
          message: `Deployment cancelled before execution (correlation ${input.correlationId}).`
        });

        return {
          deploymentId: deployment.id,
          status: 'stopped' as const,
          cancellation: 'completed'
        };
      }
    }

    await this.appendLogBestEffort({
      deploymentId: deployment.id,
      level: 'warn',
      message: `Deployment cancellation requested; worker will stop before activation (correlation ${input.correlationId}).`
    });

    return {
      deploymentId: deployment.id,
      status: deployment.status,
      cancellation: 'requested'
    };
  }

  private normalizeMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private async appendLogBestEffort(input: {
    deploymentId: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }) {
    try {
      await this.deploymentsRepository.appendLog(input);
    } catch {
      // best-effort audit trail; the cancellation state change has already been persisted
    }
  }

  private async markFailedBestEffort(deploymentId: string, prefix: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await this.deploymentsRepository.markFailed(
        deploymentId,
        `${prefix}: ${message}`
      );
    } catch {
      // best-effort state correction; preserve the stable API/domain error for the original failure
    }
  }
}
