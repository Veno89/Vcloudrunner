import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BuildSystemDetector, BuildSystemDetectionResult } from './build-system-detector.js';

const execFileAsync = promisify(execFile);

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

  async detect(repoDir: string): Promise<BuildSystemDetectionResult | null> {
    // Fast path: check common candidate paths
    for (const candidate of DOCKERFILE_CANDIDATES) {
      try {
        await execFileAsync('git', ['-C', repoDir, 'cat-file', '-e', `HEAD:${candidate}`]);
        return { type: 'dockerfile', buildFilePath: candidate };
      } catch {
        // not found
      }
    }

    // Fallback: full tree scan for any file named "dockerfile" (case-insensitive)
    try {
      const { stdout } = await execFileAsync('git', ['-C', repoDir, 'ls-tree', '-r', '--name-only', 'HEAD']);
      const files = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

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
