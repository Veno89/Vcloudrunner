import {
  createConfiguredOutboundHttpClient,
  type CreateConfiguredOutboundHttpClientOptions
} from './configured-outbound-http-client.factory.js';
import type { OutboundHttpClient } from './outbound-http-client.js';

export function createOutboundHttpClient(
  options: CreateConfiguredOutboundHttpClientOptions = {}
): OutboundHttpClient {
  return createConfiguredOutboundHttpClient(options);
}
