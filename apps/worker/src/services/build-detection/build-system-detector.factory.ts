import type { BuildSystemDetector } from './build-system-detector.js';
import { DockerfileBuildDetector } from './dockerfile-detector.js';

export function createBuildSystemDetectors(): BuildSystemDetector[] {
  return [new DockerfileBuildDetector()];
}
