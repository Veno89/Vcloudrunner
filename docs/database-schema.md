# Database Schema Overview

## Core Tables

- `users`: Account identity.
- `projects`: Git-backed deployable apps.
- `deployments`: Immutable deployment attempts and status.
- `deployment_logs`: Queryable log entries.
- `environment_variables`: Encrypted key/value config per project.
- `containers`: Runtime mapping between deployment and Docker container.
- `domains`: Hostname-to-deployment routing records.

## Relationships

- User `1 -> N` Projects
- Project `1 -> N` Deployments
- Deployment `1 -> 1` Container (current active record)
- Deployment `1 -> N` DeploymentLogs
- Project `1 -> N` EnvironmentVariables
- Project `1 -> N` Domains

## Notes

- Deployment metadata is stored as JSONB for forward compatibility.
- Enumerated deployment status enables strict state management.
