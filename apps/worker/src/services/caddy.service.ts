import { env } from '../config/env.js';

interface UpsertRouteInput {
  host: string;
  upstreamPort: number;
}

const CADDY_ADMIN_TIMEOUT_MS = 10_000;

export class CaddyService {
  async upsertRoute(input: UpsertRouteInput) {
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
        signal: AbortSignal.timeout(CADDY_ADMIN_TIMEOUT_MS)
      });
    } catch (error) {
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${response.status} ${body}`);
    }
  }
}
