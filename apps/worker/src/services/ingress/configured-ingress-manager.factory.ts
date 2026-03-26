import { createConfiguredCaddyService } from '../configured-caddy.service.factory.js';
import type { IngressManager } from './ingress-manager.js';

export interface CreateConfiguredIngressManagerOptions {
  createCaddyService?: () => IngressManager;
}

export function createConfiguredIngressManager(
  options: CreateConfiguredIngressManagerOptions = {}
): IngressManager {
  const createCaddyServiceFn = options.createCaddyService ?? createConfiguredCaddyService;
  return createCaddyServiceFn();
}
