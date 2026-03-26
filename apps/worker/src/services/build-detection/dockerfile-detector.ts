import {
  ROOT_DEPLOYMENT_SOURCE_ROOT,
  normalizeDeploymentSourceRoot
} from '../deployment-source-root.js';
import type {
  BuildSystemDetector,
  BuildSystemDetectionOptions,
  BuildSystemDetectionResult
} from './build-system-detector.js';
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

  constructor(private readonly repositoryFileInspector: RepositoryFileInspector) {}

  async detect(
    repoDir: string,
    options: BuildSystemDetectionOptions = {}
  ): Promise<BuildSystemDetectionResult | null> {
    const sourceRoot = normalizeDeploymentSourceRoot(options.sourceRoot);

    // Fast path: check common candidate paths
    for (const candidate of DOCKERFILE_CANDIDATES) {
      const buildFilePath =
        sourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT ? candidate : `${sourceRoot}/${candidate}`;

      if (await this.repositoryFileInspector.pathExists(repoDir, buildFilePath)) {
        return {
          type: 'dockerfile',
          buildFilePath,
          buildContextPath: sourceRoot
        };
      }
    }

    // Fallback: full tree scan for any file named "dockerfile" (case-insensitive)
    try {
      const files = await this.repositoryFileInspector.listPaths(repoDir);
      const dockerfile = files.find((file) => {
        if (!/(^|\/)dockerfile$/i.test(file)) {
          return false;
        }

        return (
          sourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT ||
          file.startsWith(`${sourceRoot}/`)
        );
      });
      if (dockerfile) {
        return {
          type: 'dockerfile',
          buildFilePath: dockerfile,
          buildContextPath: sourceRoot
        };
      }
    } catch {
      // git command failed
    }

    return null;
  }
}
