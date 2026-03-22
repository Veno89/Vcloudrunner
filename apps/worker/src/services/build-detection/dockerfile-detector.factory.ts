import { createRepositoryFileInspector } from './repository-file-inspector.factory.js';
import { DockerfileBuildDetector } from './dockerfile-detector.js';

export function createDockerfileBuildDetector() {
  return new DockerfileBuildDetector(createRepositoryFileInspector());
}
