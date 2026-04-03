import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ROOT_DEPLOYMENT_SOURCE_ROOT,
  normalizeDeploymentSourceRoot
} from '../deployment-source-root.js';
import type {
  BuildSystemDetector,
  BuildSystemDetectionOptions,
  BuildSystemDetectionResult
} from './build-system-detector.js';

const GENERATED_DOCKERFILE_NAME = 'Dockerfile.vcloudrunner';

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class AutoDockerfileDetector implements BuildSystemDetector {
  readonly name = 'AutoDockerfile';

  async detect(
    repoDir: string,
    options: BuildSystemDetectionOptions = {}
  ): Promise<BuildSystemDetectionResult | null> {
    const sourceRoot = normalizeDeploymentSourceRoot(options.sourceRoot);
    const contextDir =
      sourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT ? repoDir : join(repoDir, sourceRoot);

    const packageJsonPath = join(contextDir, 'package.json');

    let pkg: PackageJson;
    try {
      const raw = await readFile(packageJsonPath, 'utf-8');
      pkg = JSON.parse(raw) as PackageJson;
    } catch {
      return null;
    }

    // Discover subdirectories that have their own package.json (e.g. backend/, server/)
    const subPackageDirs = await this.findSubPackageDirs(contextDir);

    const dockerfile = generateNodeDockerfile(pkg, subPackageDirs);
    const dockerfilePath =
      sourceRoot === ROOT_DEPLOYMENT_SOURCE_ROOT
        ? GENERATED_DOCKERFILE_NAME
        : `${sourceRoot}/${GENERATED_DOCKERFILE_NAME}`;

    await writeFile(join(repoDir, dockerfilePath), dockerfile, 'utf-8');

    return {
      type: 'auto-dockerfile',
      buildFilePath: dockerfilePath,
      buildContextPath: sourceRoot
    };
  }

  private async findSubPackageDirs(contextDir: string): Promise<string[]> {
    const dirs: string[] = [];
    try {
      const entries = await readdir(contextDir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const entryPath = join(contextDir, entry);
        const entryStat = await stat(entryPath).catch(() => null);
        if (!entryStat?.isDirectory()) continue;
        const subPkgPath = join(entryPath, 'package.json');
        const exists = await stat(subPkgPath).then(() => true).catch(() => false);
        if (exists) {
          dirs.push(entry);
        }
      }
    } catch {
      // ignore
    }
    return dirs;
  }
}

function generateNodeDockerfile(pkg: PackageJson, subPackageDirs: string[]): string {
  const hasBuildScript = Boolean(pkg.scripts?.['build']);
  const hasStartScript = Boolean(pkg.scripts?.['start']);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Detect if this is a static-only site (Vite/React/Vue without a server)
  const hasExpress = Boolean(allDeps['express']);
  const hasFastify = Boolean(allDeps['fastify']);
  const startScript = pkg.scripts?.['start'] ?? '';

  // Check if start script delegates to a subdirectory
  const delegatesTo = subPackageDirs.find((dir) => startScript.includes(`cd ${dir}`));

  // A project is server-side if it has express/fastify in root deps,
  // or if its start script delegates to a subdir (which likely has server deps)
  const hasServer = hasExpress || hasFastify || Boolean(delegatesTo);

  if (!hasServer && hasBuildScript) {
    // Static site: build with Node, serve with a lightweight static server
    return [
      'FROM node:20-alpine AS build',
      'WORKDIR /app',
      'COPY package*.json ./',
      'RUN npm ci',
      'COPY . .',
      'RUN npm run build',
      '',
      'FROM node:20-alpine',
      'RUN npm i -g serve',
      'WORKDIR /app',
      'COPY --from=build /app/dist ./dist',
      'EXPOSE 3000',
      'CMD ["serve", "-s", "dist", "-l", "3000"]',
      ''
    ].join('\n');
  }

  // Server-side Node.js app
  const lines = [
    'FROM node:20-alpine',
    'WORKDIR /app',
    'COPY package*.json ./',
    'RUN npm ci',
  ];

  // Install dependencies in subdirectories that have their own package.json
  for (const dir of subPackageDirs) {
    lines.push(`COPY ${dir}/package*.json ./${dir}/`);
    lines.push(`RUN cd ${dir} && npm ci`);
  }

  lines.push('COPY . .');

  if (hasBuildScript) {
    lines.push('RUN npm run build');
  }

  // Ensure the app directory is writable at runtime (logs, temp files, etc.)
  lines.push('RUN chmod -R 777 /app');

  const startCmd = hasStartScript
    ? 'CMD ["npm", "start"]'
    : 'CMD ["node", "index.js"]';

  lines.push('', 'EXPOSE 3000', startCmd, '');

  return lines.join('\n');
}
