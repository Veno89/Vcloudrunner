import { env } from '../config/env.js';

export function buildPublicRuntimeUrl(host: string) {
  return `${env.PLATFORM_PUBLIC_URL_SCHEME}://${host}`;
}
