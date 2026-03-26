import type { OutboundHttpClient } from './http/outbound-http-client.js';
import { createConfiguredOutboundHttpClient } from './http/configured-outbound-http-client.factory.js';
import { CaddyService } from './caddy.service.js';

export type CaddyServiceConstructor = new (outboundHttpClient: OutboundHttpClient) => CaddyService;

export interface CreateConfiguredCaddyServiceOptions {
  createOutboundHttpClient?: () => OutboundHttpClient;
  ServiceClass?: CaddyServiceConstructor;
}

export function createConfiguredCaddyService(
  options: CreateConfiguredCaddyServiceOptions = {}
) {
  const createOutboundHttpClientFn =
    options.createOutboundHttpClient ?? createConfiguredOutboundHttpClient;
  const ServiceClass = options.ServiceClass ?? CaddyService;

  return new ServiceClass(createOutboundHttpClientFn());
}
