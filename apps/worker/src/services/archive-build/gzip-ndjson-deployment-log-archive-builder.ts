import { gzipSync } from 'node:zlib';

import type { DeploymentLogRow } from '../deployment-state.repository.js';
import type { DeploymentLogArchiveBuilder } from './deployment-log-archive-builder.js';

export class GzipNdjsonDeploymentLogArchiveBuilder implements DeploymentLogArchiveBuilder {
  buildArchive(rows: DeploymentLogRow[]) {
    const ndjson =
      rows
        .map((item) =>
          JSON.stringify({
            id: item.id,
            deploymentId: item.deployment_id,
            level: item.level,
            message: item.message,
            timestamp: item.timestamp
          })
        )
        .join('\n') + '\n';

    return gzipSync(ndjson);
  }
}
