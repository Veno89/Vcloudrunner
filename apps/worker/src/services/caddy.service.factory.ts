import {
  createConfiguredCaddyService,
  type CreateConfiguredCaddyServiceOptions
} from './configured-caddy.service.factory.js';

export function createCaddyService(options: CreateConfiguredCaddyServiceOptions = {}) {
  return createConfiguredCaddyService(options);
}
