import { createOutboundHttpClient } from './http/outbound-http-client.factory.js';
import { CaddyService } from './caddy.service.js';

export function createCaddyService() {
  return new CaddyService(createOutboundHttpClient());
}
