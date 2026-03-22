import type { DeploymentLogRow } from '../deployment-state.repository.js';

export interface DeploymentLogArchiveBuilder {
  buildArchive(rows: DeploymentLogRow[]): Buffer;
}
