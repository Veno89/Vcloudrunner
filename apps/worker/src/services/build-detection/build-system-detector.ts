export interface BuildSystemDetectionOptions {
  sourceRoot?: string | null;
}

export interface BuildSystemDetectionResult {
  type: string;
  buildFilePath: string;
  buildContextPath: string;
}

export interface BuildSystemDetector {
  /** Human-readable name (e.g. "Dockerfile", "Nixpacks") */
  readonly name: string;
  /** Attempt to detect a build file in the given repo directory. Return null if not found. */
  detect(
    repoDir: string,
    options?: BuildSystemDetectionOptions
  ): Promise<BuildSystemDetectionResult | null>;
}
