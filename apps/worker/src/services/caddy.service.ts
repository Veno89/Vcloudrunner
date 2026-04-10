import { env } from '../config/env.js';
import type { OutboundHttpClient } from './http/outbound-http-client.js';
import { OutboundHttpRequestError } from './http/outbound-http-client.js';
import { buildPublicRuntimeUrl } from './public-url.js';

interface UpsertRouteInput {
  host: string;
  upstreamPort: number;
  containerName?: string;
  internalPort?: number;
}

interface DeleteRouteInput {
  host: string;
}

const CADDY_ADMIN_TIMEOUT_MS = 10_000;

export class CaddyService {
  constructor(private readonly outboundHttpClient: OutboundHttpClient) {}

  async upsertRoute(input: UpsertRouteInput) {
    const routeId = `vcloudrunner-route-${input.host}`;
    // Prefer container name + internal port for Docker network routing
    const dialTarget = input.containerName && input.internalPort
      ? `${input.containerName}:${input.internalPort}`
      : `127.0.0.1:${input.upstreamPort}`;

    const routePayload = {
      '@id': routeId,
      match: [{ host: [input.host] }],
      handle: [
        {
          handler: 'reverse_proxy',
          headers: {
            request: {
              set: {
                Origin: [buildPublicRuntimeUrl(input.host)]
              }
            }
          },
          upstreams: [{ dial: dialTarget }]
        }
      ],
      terminal: true
    };

    // First try PUT by @id (update existing route in place)
    let response: Response;
    try {
      response = await this.outboundHttpClient.request({
        url: `${env.CADDY_ADMIN_URL}/id/${routeId}`,
        timeoutMs: CADDY_ADMIN_TIMEOUT_MS,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(routePayload)
        }
      });
    } catch (error) {
      const message =
        error instanceof OutboundHttpRequestError ? error.message : String(error);
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${message}`);
    }

    if (response.ok) {
      return;
    }

    // Route doesn't exist by @id — do an atomic read-modify-write of the
    // full routes array to avoid duplicates and preserve ordering.
    if (response.status === 404) {
      await this.insertRouteAtomically(routePayload, input.host);
      return;
    }

    const body = await response.text();
    throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${response.status} ${body}`);
  }

  private async insertRouteAtomically(
    routePayload: Record<string, unknown>,
    host: string
  ) {
    const routesUrl = `${env.CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`;

    // GET current routes
    let routes: Array<Record<string, unknown>>;
    try {
      const getResponse = await this.outboundHttpClient.request({
        url: routesUrl,
        timeoutMs: CADDY_ADMIN_TIMEOUT_MS,
        init: { method: 'GET' }
      });

      routes = getResponse.ok ? await getResponse.json() : [];
    } catch {
      routes = [];
    }

    // Remove ALL existing routes matching this host (dedup)
    routes = routes.filter((route) => {
      const hosts = (route.match as Array<{ host?: string[] }> | undefined)?.[0]?.host;
      return !hosts || !hosts.includes(host);
    });

    // Find the wildcard catch-all position and insert before it
    let insertAt = routes.length;
    for (let i = 0; i < routes.length; i++) {
      const hosts = (routes[i]?.match as Array<{ host?: string[] }> | undefined)?.[0]?.host;
      if (hosts && hosts.some((h) => h.startsWith('*.'))) {
        insertAt = i;
        break;
      }
    }

    routes.splice(insertAt, 0, routePayload);

    // PATCH the entire routes array back atomically
    // (Caddy uses PATCH to replace existing values; PUT is for creation only)
    let response: Response;
    try {
      response = await this.outboundHttpClient.request({
        url: routesUrl,
        timeoutMs: CADDY_ADMIN_TIMEOUT_MS,
        init: {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(routes)
        }
      });
    } catch (error) {
      const message =
        error instanceof OutboundHttpRequestError ? error.message : String(error);
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${message}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${response.status} ${body}`);
    }
  }

  async deleteRoute(input: DeleteRouteInput) {
    const routeId = `vcloudrunner-route-${input.host}`;
    let response: Response;
    try {
      response = await this.outboundHttpClient.request({
        url: `${env.CADDY_ADMIN_URL}/id/${routeId}`,
        timeoutMs: CADDY_ADMIN_TIMEOUT_MS,
        init: {
          method: 'DELETE'
        }
      });
    } catch (error) {
      const message =
        error instanceof OutboundHttpRequestError ? error.message : String(error);
      throw new Error(`CADDY_ROUTE_DELETE_FAILED: ${message}`);
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
