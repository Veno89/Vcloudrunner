import { env } from '../config/env.js';

interface ProjectDomainDiagnosticsRefreshLogger {
  warn(metadata: Record<string, unknown>, message: string): void;
}

interface ProjectDomainDiagnosticsRefreshProjectsClient {
  listProjectIdsForDomainDiagnosticsRefresh(input: {
    staleBefore: Date;
    limit: number;
  }): Promise<string[]>;
  refreshProjectDomainDiagnostics(projectId: string): Promise<unknown>;
}

interface ProjectDomainDiagnosticsRefreshServiceDependencies {
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export class ProjectDomainDiagnosticsRefreshService {
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private refreshInFlight = false;

  constructor(
    private readonly projectsService: ProjectDomainDiagnosticsRefreshProjectsClient,
    private readonly logger: ProjectDomainDiagnosticsRefreshLogger,
    dependencies: ProjectDomainDiagnosticsRefreshServiceDependencies = {}
  ) {
    this.setIntervalFn = dependencies.setIntervalFn ?? setInterval;
    this.clearIntervalFn = dependencies.clearIntervalFn ?? clearInterval;
  }

  async refreshStaleDomainDiagnostics(): Promise<{
    refreshedProjects: number;
  }> {
    const staleBefore = new Date(Date.now() - env.PROJECT_DOMAIN_DIAGNOSTICS_STALE_MS);
    const projectIds = await this.projectsService.listProjectIdsForDomainDiagnosticsRefresh({
      staleBefore,
      limit: env.PROJECT_DOMAIN_DIAGNOSTICS_BATCH_SIZE
    });

    let refreshedProjects = 0;

    for (const projectId of projectIds) {
      try {
        await this.projectsService.refreshProjectDomainDiagnostics(projectId);
        refreshedProjects += 1;
      } catch (error) {
        this.logger.warn({
          error,
          projectId
        }, 'project domain diagnostics refresh failed');
      }
    }

    return {
      refreshedProjects
    };
  }

  private async refreshWithGuard(failureMessage: string): Promise<void> {
    if (this.refreshInFlight) {
      return;
    }

    this.refreshInFlight = true;

    try {
      await this.refreshStaleDomainDiagnostics();
    } catch (error) {
      this.logger.warn({ error }, failureMessage);
    } finally {
      this.refreshInFlight = false;
    }
  }

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = this.setIntervalFn(() => {
      void this.refreshWithGuard('project domain diagnostics refresh failed');
    }, env.PROJECT_DOMAIN_DIAGNOSTICS_REFRESH_INTERVAL_MS);

    void this.refreshWithGuard('initial project domain diagnostics refresh failed');
  }

  stop(): void {
    if (this.intervalId) {
      this.clearIntervalFn(this.intervalId);
      this.intervalId = null;
    }
  }
}
