import type { BuildSystemDetectionResult, BuildSystemDetector } from './build-system-detector.js';
import { createBuildSystemDetectors } from './build-system-detector.factory.js';
import type { BuildSystemResolver } from './build-system-resolver.js';

export class ConfiguredBuildSystemResolver implements BuildSystemResolver {
  constructor(private readonly detectors: BuildSystemDetector[] = createBuildSystemDetectors()) {}

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
