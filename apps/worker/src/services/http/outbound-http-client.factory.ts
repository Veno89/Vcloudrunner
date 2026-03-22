import type { OutboundHttpClient } from './outbound-http-client.js';
import { FetchOutboundHttpClient } from './outbound-http-client.js';

export function createOutboundHttpClient(): OutboundHttpClient {
  return new FetchOutboundHttpClient();
}
