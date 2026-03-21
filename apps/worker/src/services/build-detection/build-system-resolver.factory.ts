import { ConfiguredBuildSystemResolver } from './configured-build-system-resolver.js';

export function createBuildSystemResolver() {
  return new ConfiguredBuildSystemResolver();
}
