# Database Schema Overview

## Core Tables

- `users`: Account identity.
- `projects`: Git-backed deployable apps.
- `api_tokens`: API bearer tokens bound to users with role/revocation/expiry metadata.
- `deployments`: Immutable deployment attempts and status.
- `deployment_logs`: Queryable log entries.
- `environment_variables`: Encrypted key/value config per project.
- `containers`: Runtime mapping between deployment and Docker container.
- `domains`: Hostname-to-deployment routing records.

## Relationships

- User `1 -> N` Projects
- User `1 -> N` ApiTokens
- Project `1 -> N` Deployments
- Deployment `1 -> 1` Container (current active record)
- Deployment `1 -> N` DeploymentLogs
- Project `1 -> N` EnvironmentVariables
- Project `1 -> N` Domains

## Notes

- Deployment metadata is stored as JSONB for forward compatibility.
- Enumerated deployment status enables strict state management.


## Migration Workflow

- Migration history is now committed under `apps/api/drizzle/` as SQL files + drizzle metadata.
- Apply schema changes with `npm --workspace @vcloudrunner/api run db:migrate`.
- For schema evolution, update `apps/api/src/db/schema.ts`, run `npm --workspace @vcloudrunner/api run db:generate`, and commit the generated SQL + meta changes.
- `db:push` can still be useful for local experiments but is no longer the canonical/reproducible path for team workflows.
