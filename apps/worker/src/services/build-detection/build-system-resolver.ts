import type { BuildSystemDetectionResult } from './build-system-detector.js';

export interface BuildSystemResolver {
  detect(repoDir: string): Promise<BuildSystemDetectionResult | null>;
}
