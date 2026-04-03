import type { BuildSystemDetector } from './build-system-detector.js';
import { createDockerfileBuildDetector } from './dockerfile-detector.factory.js';
import { AutoDockerfileDetector } from './auto-dockerfile-detector.js';

export function createBuildSystemDetectors(): BuildSystemDetector[] {
  return [createDockerfileBuildDetector(), new AutoDockerfileDetector()];
}
