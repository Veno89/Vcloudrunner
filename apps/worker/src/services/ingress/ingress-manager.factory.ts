import {
  createConfiguredIngressManager,
  type CreateConfiguredIngressManagerOptions
} from './configured-ingress-manager.factory.js';
import type { IngressManager } from './ingress-manager.js';

export function createIngressManager(
  options: CreateConfiguredIngressManagerOptions = {}
): IngressManager {
  return createConfiguredIngressManager(options);
}
