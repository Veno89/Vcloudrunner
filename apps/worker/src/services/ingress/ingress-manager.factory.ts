import { CaddyService } from '../caddy.service.js';
import type { IngressManager } from './ingress-manager.js';

export function createIngressManager(): IngressManager {
  return new CaddyService();
}
