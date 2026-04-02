# Database Schema Overview

Schema source: `apps/api/src/db/schema.ts` (Drizzle ORM, PostgreSQL)

---

## Enums

| Enum | Values |
|------|--------|
| `deployment_status` | `queued`, `building`, `running`, `failed`, `stopped` |
| `project_member_role` | `viewer`, `editor`, `admin` |
| `project_invitation_status` | `pending`, `accepted`, `cancelled` |
| `project_database_engine` | `postgres` |
| `project_database_status` | `pending_config`, `provisioning`, `ready`, `failed` |
| `project_database_health_status` | `unknown`, `healthy`, `unreachable`, `credentials_invalid`, `failing` |
| `project_database_backup_mode` | `none`, `external` |
| `project_database_backup_schedule` | `daily`, `weekly`, `monthly`, `custom` |
| `project_database_event_kind` | `provisioning`, `runtime_health`, `credentials`, `backup_policy`, `recovery_check`, `backup_operation`, `restore_operation`, `backup_artifact`, `restore_request` |
| `project_database_operation_kind` | `backup`, `restore` |
| `project_database_operation_status` | `succeeded`, `failed` |
| `project_database_backup_artifact_storage_provider` | `s3`, `gcs`, `azure`, `local`, `other` |
| `project_database_backup_artifact_integrity_status` | `unknown`, `verified`, `failed` |
| `project_database_backup_artifact_lifecycle_status` | `active`, `archived`, `purged` |
| `project_database_restore_request_status` | `requested`, `in_progress`, `succeeded`, `failed`, `cancelled` |
| `project_database_restore_request_approval_status` | `pending`, `approved`, `rejected` |
| `project_domain_ownership_status` | `managed`, `verified`, `pending`, `mismatch`, `unknown` |
| `project_domain_verification_status` | `managed`, `verified`, `pending`, `mismatch`, `unknown` |
| `project_domain_tls_status` | `ready`, `pending`, `invalid`, `unknown` |
| `project_domain_event_kind` | `ownership`, `tls`, `certificate`, `certificate_trust`, `certificate_path_validity`, `certificate_identity`, `certificate_attention`, `certificate_chain` |

---

## Tables

### `users`

Account identity. Supports email+password authentication (optional `password_hash`).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, random default |
| `email` | varchar(320) | NOT NULL, unique index |
| `name` | varchar(128) | NOT NULL |
| `password_hash` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

### `api_tokens`

Bearer tokens for API access. Supports SHA-256 hash-based lookup, scopes (JSONB array), revocation, and expiry. Also used for dashboard session tokens.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → users |
| `token` | text | nullable, unique (legacy plain-text; new tokens are hashed) |
| `token_hash` | text | NOT NULL, unique |
| `token_last4` | varchar(4) | NOT NULL |
| `role` | varchar(16) | NOT NULL, default `'user'` |
| `scopes` | jsonb (string[]) | NOT NULL, default `[]` |
| `label` | varchar(128) | nullable |
| `expires_at` | timestamptz | nullable |
| `revoked_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: `user_id`

### `projects`

Git-backed deployable application projects. Each project may define multiple services via the JSONB `services` column.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → users |
| `name` | varchar(64) | NOT NULL |
| `slug` | varchar(64) | NOT NULL, unique |
| `git_repository_url` | text | NOT NULL |
| `default_branch` | varchar(255) | NOT NULL, default `'main'` |
| `services` | jsonb (ProjectServiceDefinition[]) | NOT NULL, default single `web` service |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: `user_id`

### `deployments`

Immutable deployment attempts. Each deployment targets a specific service within a project.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects |
| `service_name` | varchar(32) | NOT NULL, default `'web'` |
| `status` | deployment_status | NOT NULL, default `'queued'` |
| `commit_sha` | varchar(64) | nullable |
| `branch` | varchar(255) | nullable |
| `build_logs_url` | text | nullable |
| `runtime_url` | text | nullable |
| `metadata` | jsonb | NOT NULL, default `{}` |
| `created_at` / `updated_at` | timestamptz | NOT NULL |
| `started_at` / `finished_at` | timestamptz | nullable |

Indexes: `project_id`, composite `(project_id, service_name)`, `status`

### `environment_variables`

Encrypted key/value configuration per project.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects |
| `key` | varchar(255) | NOT NULL |
| `encrypted_value` | text | NOT NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: `project_id`, unique `(project_id, key)`

### `containers`

Runtime mapping between a deployment and its Docker container.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `deployment_id` | uuid | NOT NULL, FK → deployments, unique |
| `container_id` | varchar(128) | NOT NULL, unique |
| `image` | varchar(255) | NOT NULL |
| `internal_port` | integer | NOT NULL |
| `host_port` | integer | NOT NULL |
| `is_healthy` | boolean | NOT NULL, default false |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

### `deployment_logs`

Queryable log entries per deployment.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `deployment_id` | uuid | NOT NULL, FK → deployments |
| `level` | varchar(16) | NOT NULL, default `'info'` |
| `message` | text | NOT NULL |
| `timestamp` | timestamptz | NOT NULL, default now |

Indexes: `deployment_id`

### `domains`

Custom hostname routing records with full domain ownership verification, TLS status, and deep certificate observability.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects |
| `deployment_id` | uuid | nullable, FK → deployments |
| `host` | varchar(255) | NOT NULL, unique |
| `target_port` | integer | NOT NULL |
| **Verification** | | |
| `verification_token` | varchar(96) | nullable |
| `verification_status` | project_domain_verification_status | nullable |
| `verification_detail` | text | nullable |
| `verification_checked_at` / `verification_status_changed_at` / `verification_verified_at` | timestamptz | nullable |
| **Ownership & TLS** | | |
| `ownership_status` | project_domain_ownership_status | nullable |
| `ownership_detail` | text | nullable |
| `tls_status` | project_domain_tls_status | nullable |
| `tls_detail` | text | nullable |
| **Certificate metadata** | | |
| `certificate_valid_from` / `certificate_valid_to` | timestamptz | nullable |
| `certificate_subject_name` / `certificate_issuer_name` | text | nullable |
| `certificate_subject_alt_names` | jsonb (string[]) | NOT NULL, default `[]` |
| `certificate_fingerprint_sha256` | varchar(128) | nullable |
| `certificate_serial_number` | varchar(128) | nullable |
| **Certificate chain** | | |
| `certificate_chain_subjects` | jsonb (string[]) | NOT NULL, default `[]` |
| `certificate_chain_entries` | jsonb (ChainEntry[]) | NOT NULL, default `[]` |
| `certificate_root_subject_name` | text | nullable |
| `certificate_last_healthy_chain_entries` | jsonb (ChainEntry[]) | NOT NULL, default `[]` |
| **Certificate lifecycle tracking** | | |
| `certificate_chain_changed_at` / `certificate_chain_observed_count` | timestamptz / integer | |
| `certificate_chain_last_healthy_at` | timestamptz | nullable |
| `certificate_path_validity_changed_at` / `certificate_path_validity_observed_count` | timestamptz / integer | |
| `certificate_path_validity_last_healthy_at` | timestamptz | nullable |
| `certificate_validation_reason` | varchar(64) | nullable |
| `certificate_first_observed_at` / `certificate_changed_at` / `certificate_last_rotated_at` | timestamptz | nullable |
| `certificate_guidance_changed_at` / `certificate_guidance_observed_count` | timestamptz / integer | |
| **Diagnostics & status change tracking** | | |
| `diagnostics_checked_at` / `ownership_status_changed_at` / `tls_status_changed_at` | timestamptz | nullable |
| `ownership_verified_at` / `tls_ready_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

### `project_domain_events`

Audit log for domain status transitions (ownership, TLS, certificate changes).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `domain_id` | uuid | NOT NULL, FK → domains (cascade) |
| `kind` | project_domain_event_kind | NOT NULL |
| `previous_status` | varchar(32) | nullable |
| `next_status` | varchar(32) | NOT NULL |
| `detail` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

Indexes: `(domain_id, created_at)`, `(project_id, created_at)`

### `project_members`

Team membership linking users to projects with role-based access.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `user_id` | uuid | NOT NULL, FK → users (cascade) |
| `role` | project_member_role | NOT NULL, default `'viewer'` |
| `invited_by` | uuid | nullable, FK → users |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: unique `(project_id, user_id)`, `user_id`

### `project_invitations`

Pending/accepted/cancelled project invitations with claim tokens for email-based onboarding.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `email` | varchar(320) | NOT NULL |
| `claim_token` | varchar(64) | NOT NULL, unique |
| `role` | project_member_role | NOT NULL, default `'viewer'` |
| `status` | project_invitation_status | NOT NULL, default `'pending'` |
| `invited_by` | uuid | nullable, FK → users |
| `accepted_by_user_id` | uuid | nullable, FK → users |
| `accepted_at` / `cancelled_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: unique `claim_token`, unique `(project_id, email)` where status = `'pending'`, `(project_id, status, updated_at)`

### `project_databases`

Managed database instances per project (currently Postgres only). Tracks provisioning, health, credentials, and backup configuration.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `engine` | project_database_engine | NOT NULL, default `'postgres'` |
| `name` | varchar(48) | NOT NULL |
| `status` | project_database_status | NOT NULL, default `'pending_config'` |
| `status_detail` | text | NOT NULL, default `''` |
| `database_name` | varchar(63) | NOT NULL, unique |
| `username` | varchar(63) | NOT NULL, unique |
| `encrypted_password` | text | NOT NULL |
| `connection_host` / `connection_port` / `connection_ssl_mode` | varchar / integer / varchar | nullable |
| **Health** | | |
| `health_status` | project_database_health_status | NOT NULL, default `'unknown'` |
| `health_status_detail` | text | NOT NULL |
| `health_status_changed_at` / `last_health_check_at` / `last_healthy_at` / `last_health_error_at` | timestamptz | nullable |
| `consecutive_health_check_failures` | integer | NOT NULL, default 0 |
| **Credentials & backup** | | |
| `credentials_rotated_at` | timestamptz | nullable |
| `backup_mode` | project_database_backup_mode | NOT NULL, default `'none'` |
| `backup_schedule` | project_database_backup_schedule | nullable |
| `backup_runbook` | text | NOT NULL, default `''` |
| `backup_verified_at` / `restore_verified_at` | timestamptz | nullable |
| **Provisioning** | | |
| `provisioned_at` / `last_provisioning_attempt_at` / `last_error_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: unique `(project_id, name)`, unique `database_name`, unique `username`, `(project_id, status)`

### `project_database_service_links`

Maps a managed database to the project services that consume it.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_database_id` | uuid | NOT NULL, FK → project_databases (cascade) |
| `service_name` | varchar(32) | NOT NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: unique `(project_database_id, service_name)`, `service_name`

### `project_database_events`

Audit log for managed database lifecycle transitions.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `database_id` | uuid | NOT NULL, FK → project_databases (cascade) |
| `kind` | project_database_event_kind | NOT NULL |
| `previous_status` / `next_status` | varchar(48) | next NOT NULL |
| `detail` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

Indexes: `(database_id, created_at)`, `(project_id, created_at)`

### `project_database_operations`

Records of completed backup/restore operations.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `database_id` | uuid | NOT NULL, FK → project_databases (cascade) |
| `kind` | project_database_operation_kind | NOT NULL |
| `status` | project_database_operation_status | NOT NULL |
| `summary` | text | NOT NULL |
| `detail` | text | NOT NULL, default `''` |
| `recorded_at` | timestamptz | NOT NULL, default now |

Indexes: `(database_id, recorded_at)`, `(project_id, recorded_at)`

### `project_database_backup_artifacts`

Tracked backup artifacts with storage, integrity, and retention metadata.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `database_id` | uuid | NOT NULL, FK → project_databases (cascade) |
| `label` | varchar(160) | NOT NULL |
| `storage_provider` | project_database_backup_artifact_storage_provider | NOT NULL, default `'other'` |
| `location` | text | NOT NULL |
| `size_bytes` | bigint | nullable |
| `produced_at` | timestamptz | NOT NULL |
| `retention_expires_at` | timestamptz | nullable |
| `integrity_status` | project_database_backup_artifact_integrity_status | NOT NULL, default `'unknown'` |
| `lifecycle_status` | project_database_backup_artifact_lifecycle_status | NOT NULL, default `'active'` |
| `verified_at` / `lifecycle_changed_at` | timestamptz | |
| `detail` | text | NOT NULL, default `''` |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: `(database_id, produced_at)`, `(project_id, created_at)`

### `project_database_restore_requests`

Restore request workflow with approval gates.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `project_id` | uuid | NOT NULL, FK → projects (cascade) |
| `database_id` | uuid | NOT NULL, FK → project_databases (cascade) |
| `backup_artifact_id` | uuid | nullable, FK → project_database_backup_artifacts (set null on delete) |
| `status` | project_database_restore_request_status | NOT NULL, default `'requested'` |
| `approval_status` | project_database_restore_request_approval_status | NOT NULL, default `'pending'` |
| `approval_detail` | text | NOT NULL, default `''` |
| `approval_reviewed_at` | timestamptz | nullable |
| `target` | varchar(160) | NOT NULL |
| `summary` | text | NOT NULL |
| `detail` | text | NOT NULL, default `''` |
| `requested_at` | timestamptz | NOT NULL, default now |
| `started_at` / `completed_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

Indexes: `(database_id, requested_at)`, `(project_id, created_at)`, `backup_artifact_id`

---

## Relationships

- User `1 → N` Projects (owner)
- User `1 → N` ApiTokens
- User `1 → N` ProjectMembers (via membership)
- Project `1 → N` Deployments
- Project `1 → N` EnvironmentVariables
- Project `1 → N` Domains
- Project `1 → N` ProjectMembers
- Project `1 → N` ProjectInvitations
- Project `1 → N` ProjectDatabases
- Project `1 → N` ProjectDomainEvents
- Deployment `1 → 1` Container
- Deployment `1 → N` DeploymentLogs
- Domain `1 → N` ProjectDomainEvents
- ProjectDatabase `1 → N` ProjectDatabaseServiceLinks
- ProjectDatabase `1 → N` ProjectDatabaseEvents
- ProjectDatabase `1 → N` ProjectDatabaseOperations
- ProjectDatabase `1 → N` ProjectDatabaseBackupArtifacts
- ProjectDatabase `1 → N` ProjectDatabaseRestoreRequests
- ProjectDatabaseBackupArtifact `1 → N` ProjectDatabaseRestoreRequests

---

## Notes

- All primary keys are UUID v4 with random defaults.
- All tables include `created_at` / `updated_at` timestamptz columns.
- Deployment metadata is stored as JSONB for forward compatibility.
- Project `services` uses a JSONB column holding `ProjectServiceDefinition[]` (from `@vcloudrunner/shared-types`).
- API token lookup uses SHA-256 hashed tokens (`token_hash`); the plain `token` column is nullable for backward compatibility.
- Environment variable values are encrypted at rest (`encrypted_value`).
- Managed database passwords are encrypted at rest (`encrypted_password`).
- Domain tables include extensive certificate chain and path validity tracking for deep TLS observability.
- Cascade deletes are used on project-scoped child tables (members, invitations, databases, domain events).

---

## Migration Workflow

- Migration history lives under `apps/api/drizzle/` as SQL files + Drizzle metadata.
- Apply migrations: `npm --workspace @vcloudrunner/api run db:migrate`
- Generate new migration: update `apps/api/src/db/schema.ts`, then `npm --workspace @vcloudrunner/api run db:generate`
- Commit the generated SQL + meta changes.
- `db:push` is useful for local experiments but is not the canonical reproducible path.
