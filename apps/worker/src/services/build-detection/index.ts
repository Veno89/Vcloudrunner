import type { BuildSystemDetector, BuildSystemDetectionResult } from './build-system-detector.js';
import { DockerfileBuildDetector } from './dockerfile-detector.js';

export type { BuildSystemDetector, BuildSystemDetectionResult };

const defaultDetectors: BuildSystemDetector[] = [
  new DockerfileBuildDetector(),
];

/**
 * Run all registered detectors in priority order, returning the first match.
 * Add new detectors (e.g. Nixpacks, Buildpacks) by appending to the array.
 */
export async function detectBuildSystem(
  repoDir: string,
  detectors: BuildSystemDetector[] = defaultDetectors
): Promise<BuildSystemDetectionResult | null> {
  for (const detector of detectors) {
    const result = await detector.detect(repoDir);
    if (result) return result;
  }
  return null;
}
