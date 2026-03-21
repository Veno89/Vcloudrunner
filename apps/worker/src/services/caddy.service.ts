import { env } from '../config/env.js';

interface UpsertRouteInput {
  host: string;
  upstreamPort: number;
}

interface DeleteRouteInput {
  host: string;
}

const CADDY_ADMIN_TIMEOUT_MS = 10_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class CaddyService {
  async upsertRoute(input: UpsertRouteInput) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CADDY_ADMIN_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${env.CADDY_ADMIN_URL}/id/vcloudrunner/routes/${input.host}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          '@id': `vcloudrunner/routes/${input.host}`,
          match: [
            {
              host: [input.host]
            }
          ],
          handle: [
            {
              handler: 'reverse_proxy',
              upstreams: [
                {
                  dial: `127.0.0.1:${input.upstreamPort}`
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });
    } catch (error) {
      throw controller.signal.aborted
        ? new Error(`CADDY_ROUTE_UPDATE_FAILED: request timed out after ${CADDY_ADMIN_TIMEOUT_MS}ms`)
        : new Error(`CADDY_ROUTE_UPDATE_FAILED: ${getErrorMessage(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${response.status} ${body}`);
    }
  }

  async deleteRoute(input: DeleteRouteInput) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CADDY_ADMIN_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${env.CADDY_ADMIN_URL}/id/vcloudrunner/routes/${input.host}`, {
        method: 'DELETE',
        signal: controller.signal
      });
    } catch (error) {
      throw controller.signal.aborted
        ? new Error(`CADDY_ROUTE_DELETE_FAILED: request timed out after ${CADDY_ADMIN_TIMEOUT_MS}ms`)
        : new Error(`CADDY_ROUTE_DELETE_FAILED: ${getErrorMessage(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_DELETE_FAILED: ${response.status} ${body}`);
    }
  }
}
