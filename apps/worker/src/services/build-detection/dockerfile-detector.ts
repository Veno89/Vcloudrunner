import type { BuildSystemDetector, BuildSystemDetectionResult } from './build-system-detector.js';
import { createRepositoryFileInspector } from './repository-file-inspector.factory.js';
import type { RepositoryFileInspector } from './repository-file-inspector.js';

const DOCKERFILE_CANDIDATES = [
  'Dockerfile',
  'dockerfile',
  'docker/Dockerfile',
  'Docker/Dockerfile',
  'app/Dockerfile',
  'apps/Dockerfile',
  'backend/Dockerfile',
  'server/Dockerfile',
];

export class DockerfileBuildDetector implements BuildSystemDetector {
  readonly name = 'Dockerfile';

  constructor(
    private readonly repositoryFileInspector: RepositoryFileInspector = createRepositoryFileInspector()
  ) {}

  async detect(repoDir: string): Promise<BuildSystemDetectionResult | null> {
    // Fast path: check common candidate paths
    for (const candidate of DOCKERFILE_CANDIDATES) {
      if (await this.repositoryFileInspector.pathExists(repoDir, candidate)) {
        return { type: 'dockerfile', buildFilePath: candidate };
      }
    }

    // Fallback: full tree scan for any file named "dockerfile" (case-insensitive)
    try {
      const files = await this.repositoryFileInspector.listPaths(repoDir);
      const dockerfile = files.find((file) => /(^|\/)dockerfile$/i.test(file));
      if (dockerfile) {
        return { type: 'dockerfile', buildFilePath: dockerfile };
      }
    } catch {
      // git command failed
    }

    return null;
  }
}
