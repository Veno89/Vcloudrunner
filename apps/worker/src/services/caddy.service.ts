import { env } from '../config/env.js';

interface UpsertRouteInput {
  host: string;
  upstreamPort: number;
}

export class CaddyService {
  async upsertRoute(input: UpsertRouteInput) {
    const response = await fetch(`${env.CADDY_ADMIN_URL}/id/vcloudrunner/routes/${input.host}`, {
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
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CADDY_ROUTE_UPDATE_FAILED: ${response.status} ${body}`);
    }
  }
}
