import type {
  BuildSystemDetectionOptions,
  BuildSystemDetectionResult,
  BuildSystemDetector
} from './build-system-detector.js';
import type { BuildSystemResolver } from './build-system-resolver.js';

export class ConfiguredBuildSystemResolver implements BuildSystemResolver {
  constructor(private readonly detectors: BuildSystemDetector[]) {}

  async detect(
    repoDir: string,
    options?: BuildSystemDetectionOptions
  ): Promise<BuildSystemDetectionResult | null> {
    for (const detector of this.detectors) {
      const result = await detector.detect(repoDir, options);
      if (result) {
        return result;
      }
    }

    return null;
  }
}
