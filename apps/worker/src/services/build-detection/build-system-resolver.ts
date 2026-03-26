import type {
  BuildSystemDetectionOptions,
  BuildSystemDetectionResult
} from './build-system-detector.js';

export interface BuildSystemResolver {
  detect(repoDir: string, options?: BuildSystemDetectionOptions): Promise<BuildSystemDetectionResult | null>;
}
