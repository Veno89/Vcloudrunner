import type { OutboundHttpClient } from './outbound-http-client.js';
import { FetchOutboundHttpClient } from './outbound-http-client.js';

export type OutboundHttpClientConstructor = new () => OutboundHttpClient;

export interface CreateConfiguredOutboundHttpClientOptions {
  ClientClass?: OutboundHttpClientConstructor;
}

export function createConfiguredOutboundHttpClient(
  options: CreateConfiguredOutboundHttpClientOptions = {}
): OutboundHttpClient {
  const ClientClass = options.ClientClass ?? FetchOutboundHttpClient;
  return new ClientClass();
}
