import { createConfiguredBuildSystemResolver } from './configured-build-system-resolver.factory.js';

export function createBuildSystemResolver() {
  return createConfiguredBuildSystemResolver();
}
