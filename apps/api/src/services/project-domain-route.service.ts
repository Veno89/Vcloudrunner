import { env } from '../config/env.js';

const CADDY_ADMIN_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export interface ProjectDomainRouteManager {
  deactivateRoute(input: {
    host: string;
  }): Promise<void>;
}

interface CaddyProjectDomainRouteServiceDependencies {
  fetchFn?: typeof fetch;
  caddyAdminUrl?: string;
  timeoutMs?: number;
}

export class CaddyProjectDomainRouteService implements ProjectDomainRouteManager {
  private readonly fetchFn: typeof fetch;
  private readonly caddyAdminUrl: string;
  private readonly timeoutMs: number;

  constructor(dependencies: CaddyProjectDomainRouteServiceDependencies = {}) {
    this.fetchFn = dependencies.fetchFn ?? fetch;
    this.caddyAdminUrl = normalizeBaseUrl(dependencies.caddyAdminUrl ?? env.CADDY_ADMIN_URL);
    this.timeoutMs = dependencies.timeoutMs ?? CADDY_ADMIN_TIMEOUT_MS;
  }

  async deactivateRoute(input: {
    host: string;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(`${this.caddyAdminUrl}/id/vcloudrunner/routes/${input.host}`, {
        method: 'DELETE',
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(
        controller.signal.aborted
          ? `CADDY_ROUTE_DELETE_FAILED: request timed out after ${this.timeoutMs}ms`
          : `CADDY_ROUTE_DELETE_FAILED: ${getErrorMessage(error)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_DELETE_FAILED: ${response.status} ${body}`);
    }
  }
}

export const defaultProjectDomainRouteService = new CaddyProjectDomainRouteService();
