import type { BuildSystemDetector } from './build-system-detector.js';
import { createDockerfileBuildDetector } from './dockerfile-detector.factory.js';

export function createBuildSystemDetectors(): BuildSystemDetector[] {
  return [createDockerfileBuildDetector()];
}
