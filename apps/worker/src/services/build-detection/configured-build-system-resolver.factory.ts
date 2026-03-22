import { createBuildSystemDetectors } from './build-system-detector.factory.js';
import { ConfiguredBuildSystemResolver } from './configured-build-system-resolver.js';

export function createConfiguredBuildSystemResolver() {
  return new ConfiguredBuildSystemResolver(createBuildSystemDetectors());
}
