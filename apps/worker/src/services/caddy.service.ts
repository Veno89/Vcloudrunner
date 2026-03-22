import { env } from '../config/env.js';
import type { OutboundHttpClient } from './http/outbound-http-client.js';
import { OutboundHttpRequestError } from './http/outbound-http-client.js';

interface UpsertRouteInput {
  host: string;
  upstreamPort: number;
}

interface DeleteRouteInput {
  host: string;
}

const CADDY_ADMIN_TIMEOUT_MS = 10_000;

export class CaddyService {
  constructor(private readonly outboundHttpClient: OutboundHttpClient) {}

  async upsertRoute(input: UpsertRouteInput) {
    let response: Response;
    try {
      response = await this.outboundHttpClient.request({
        url: `${env.CADDY_ADMIN_URL}/id/vcloudrunner/routes/${input.host}`,
        timeoutMs: CADDY_ADMIN_TIMEOUT_MS,
        init: {
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
    let response: Response;
    try {
      response = await this.outboundHttpClient.request({
        url: `${env.CADDY_ADMIN_URL}/id/vcloudrunner/routes/${input.host}`,
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
