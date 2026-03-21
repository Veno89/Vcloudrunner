export interface RepositoryFileInspector {
  pathExists(repoDir: string, filePath: string): Promise<boolean>;
  listPaths(repoDir: string): Promise<string[]>;
}
