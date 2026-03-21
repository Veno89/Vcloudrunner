import type { BuildSystemDetectionResult, BuildSystemDetector } from './build-system-detector.js';
import { DockerfileBuildDetector } from './dockerfile-detector.js';
import type { BuildSystemResolver } from './build-system-resolver.js';

const defaultDetectors: BuildSystemDetector[] = [
  new DockerfileBuildDetector(),
];

export class ConfiguredBuildSystemResolver implements BuildSystemResolver {
  constructor(private readonly detectors: BuildSystemDetector[] = defaultDetectors) {}

  async detect(repoDir: string): Promise<BuildSystemDetectionResult | null> {
    for (const detector of this.detectors) {
      const result = await detector.detect(repoDir);
      if (result) {
        return result;
      }
    }

    return null;
  }
}
