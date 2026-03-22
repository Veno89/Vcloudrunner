import { createCaddyService } from '../caddy.service.factory.js';
import type { IngressManager } from './ingress-manager.js';

export function createIngressManager(): IngressManager {
  return createCaddyService();
}
