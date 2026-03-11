# Vcloudrunner MVP Progress Tracker

Last updated: 2026-03-11 (archive lifecycle cleanup controls slice)

## Legend

- [x] Done
- [~] In progress / partial
- [ ] Not started


## Implementation Log

### Phase: Archive lifecycle cleanup controls slice (2026-03-11)

- what was built:
  - worker now includes scheduled cleanup sweeps for local archive artifacts and upload markers
  - added lifecycle controls for cleanup interval and max-age policies for archive files and marker files
  - cleanup only prunes uploaded archive files (`.uploaded` marker present) and stale marker artifacts by age
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing integrations for S3/GCS/Azure
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native SDK/signing integrations for S3/GCS/Azure

### Phase: Provider archive adapter slice (2026-03-11)

- what was built:
  - archive upload now supports provider-specific target URL adapters (`http`, `s3`, `gcs`, `azure`) selected via worker config
  - added provider-specific config inputs for bucket/container and key prefixes to support storage-specific object key routing
  - retained existing upload retry/backoff/timeout semantics and marker-file dedupe behavior
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing integrations and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native SDK/signing integrations for S3/GCS/Azure and archive lifecycle policy controls

### Phase: Archive upload retry/backoff slice (2026-03-11)

- what was built:
  - archive upload sweeps now retry failed uploads with exponential backoff and configurable cap
  - added upload retry controls via worker env (`DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS`, `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS`, `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS`)
  - upload failure now surfaces terminal retry-exhausted errors while preserving existing marker-file semantics
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - first-class provider integrations (S3/GCS/Azure SDK paths) and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native object storage adapters (S3/GCS/Azure) and archive lifecycle policy controls

### Phase: Archive upload backend slice (2026-03-11)

- what was built:
  - worker now supports scheduled upload sweeps for archived `.ndjson.gz` files to object-storage-compatible HTTP endpoints
  - upload pipeline includes optional bearer auth, timeout control, success marker files, and optional local file deletion after upload
  - added configurable env controls for archive upload base URL, auth token, interval, timeout, and local-delete behavior
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - first-class provider integrations (S3/GCS/Azure SDK paths), retry/backoff policy controls, and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native object storage adapters (S3/GCS/Azure) with retry/backoff and archive lifecycle policy controls

### Phase: Scheduled log archival sweep slice (2026-03-11)

- what was built:
  - worker now runs periodic archival sweeps for eligible completed deployments and writes compressed NDJSON archives to local storage
  - archival behavior is configurable via new worker env vars (`DEPLOYMENT_LOG_ARCHIVE_DIR`, `DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS`)
  - archived file format aligns with export contract (`<deploymentId>.ndjson.gz`)
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - object-storage archival backend integration and managed retention lifecycle for archived artifacts
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add object-storage archival backend integration and scheduled export/upload jobs

### Phase: Compressed log export slice (2026-03-11)

- what was built:
  - deployment log export now supports compressed downloads (`format=ndjson.gz`) in addition to plain NDJSON
  - dashboard log export proxy now forwards format selection and preserves gzip content metadata
  - logs panel now exposes both export actions (`Export NDJSON`, `Export GZIP`) for selected deployment
- files created or changed:
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - object-storage archival backend + scheduled export workflows
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add object-storage archival backend integration and scheduled export jobs

### Phase: Deployment log export slice (2026-03-11)

- what was built:
  - API now exposes deployment log export endpoint (`GET /v1/projects/:projectId/deployments/:deploymentId/logs/export`) returning NDJSON attachments
  - dashboard now includes authenticated server-side proxy route (`/api/log-export`) for browser-safe downloads
  - logs UI now includes an Export NDJSON action for selected deployment
- files created or changed:
  - `apps/api/src/modules/logs/logs.repository.ts`
  - `apps/api/src/modules/logs/logs.service.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - optional compressed export/storage backend integration (object storage, scheduled archival jobs)
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add optional compressed/object-storage archival workflow and scheduled export jobs

### Phase: Dashboard token lifecycle UX slice (2026-03-11)

- what was built:
  - dashboard now renders an API token management panel for live mode (list/create/revoke)
  - token create form supports label, role, and optional expiration timestamp inputs
  - revoke actions are wired per-token; revoked tokens are shown as non-actionable status
  - dashboard API client now includes typed helpers for token list/create/revoke endpoints
- files created or changed:
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add archival/export path for long-term deployment log storage beyond DB retention window

### Phase: Token lifecycle endpoints slice (2026-03-11)

- what was built:
  - added authenticated API token lifecycle endpoints for user scope: list, create, and revoke
  - token create endpoint returns plaintext token once; list endpoint returns token previews to avoid full-token exposure
  - token lifecycle routes enforce existing actor ownership checks (`assertUserAccess`)
  - wired token routes into API server and updated README endpoint/auth docs
- files created or changed:
  - `apps/api/src/modules/api-tokens/api-tokens.repository.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.service.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/api/src/server/build-server.ts`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - dashboard/admin UX for token lifecycle management
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add dashboard/admin UX for token lifecycle management (create/revoke + safe copy-on-create)

### Phase: DB-backed auth token slice (2026-03-11)

- what was built:
  - API auth now resolves bearer tokens from a database-backed `api_tokens` table before checking static env tokens
  - auth token model now supports per-token role, optional expiration, and revocation timestamps
  - retained `API_TOKENS_JSON` fallback path for bootstrap/dev compatibility during transition
  - committed drizzle migration adding `api_tokens` table + indexes + user foreign-key
- files created or changed:
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/drizzle/0001_right_steve_rogers.sql`
  - `apps/api/drizzle/meta/0001_snapshot.json`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/.env.example`
  - `README.md`
  - `docs/database-schema.md`
  - `docs/progress.md`
- what is still missing:
  - long-term archival/export path for deployment logs beyond DB retention window
  - token lifecycle management endpoints/UX (create, rotate, revoke)
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add token lifecycle management endpoints and dashboard/admin UX for create/rotate/revoke

### Phase: Unified structured logging slice (2026-03-11)

- what was built:
  - aligned API and worker log envelopes to include consistent top-level keys (`timestamp`, `level`, `service`, `message`)
  - API Fastify logger now emits `message` key and service base metadata (`service: api`) with ISO timestamps
  - worker logger now honors configured log level filtering and emits service-tagged structured records
- files created or changed:
  - `apps/api/src/server/build-server.ts`
  - `apps/worker/src/logger/logger.ts`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - evolve bearer token config into DB-backed auth/session model with revocation and rotation

### Phase: Worker reliability test coverage slice (2026-03-11)

- what was built:
  - added worker unit tests for retry classification helpers (`isNonRetryableDeploymentError`, `remainingAttempts`)
  - added service-level tests for deployment-log retention behavior (`appendLog`, `markFailed`, `pruneLogsByRetentionWindow`)
  - refactored worker retry helper logic into `deployment-worker.utils.ts` for focused testability
  - made `DeploymentStateService` accept an optional queryable dependency to enable deterministic service tests without a live Postgres instance
  - added worker `npm test` script to run Node test files via `tsx --test` with local test env defaults
- files created or changed:
  - `apps/worker/src/workers/deployment-worker.utils.ts`
  - `apps/worker/src/workers/deployment-worker.utils.test.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/package.json`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - unified structured logging format across services
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add unified structured logging format across services

### Phase: Project-create UX polish slice (2026-03-11)

- what was built:
  - dashboard project-create form now has optimistic pending state (`Creating…`) and disables submit while action is in flight
  - added inline field-level validation hints for name/slug/repository URL/default branch constraints
  - added live slug preview so users can see the derived slug before submitting
- files created or changed:
  - `apps/dashboard/components/project-create-form.tsx`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - worker unit/integration tests around retry and retention behavior
  - unified structured logging format across services
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add worker unit/integration tests around retry classification/backoff and log retention behavior

### Phase: Bounded log retention policy slice (2026-03-11)

- what was built:
  - worker now enforces per-deployment log row caps on each log write
  - worker now runs periodic retention pruning by log age window
  - retention controls are configurable via worker env (`DEPLOYMENT_LOG_RETENTION_DAYS`, `DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT`, `DEPLOYMENT_LOG_PRUNE_INTERVAL_MS`)
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/.env.example`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - optimistic project-create UX pending/disabled state polish
  - worker unit/integration tests around retry and retention behavior
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add optimistic project-create UX (pending/disabled state + richer field-level validation)


### Phase: Bearer auth boundary upgrade slice (2026-03-11)

- what was built:
  - API auth now uses `Authorization: Bearer` token mapping (`API_TOKENS_JSON`) instead of trusting raw `x-user-id` headers
  - project/deployment/environment/log routes now read actor context from authenticated token claims (userId + role)
  - dashboard API client and SSE proxy now send bearer token via `API_AUTH_TOKEN`
- files created or changed:
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/api/.env.example`
  - `apps/dashboard/.env.example`
  - `README.md`
  - `docs/architecture.md`
  - `docs/progress.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - bounded retention policy/archival strategy for deployment logs
  - optimistic project-create UX pending/disabled state polish
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add bounded retention policy/archival strategy for deployment logs


### Phase: Workspace type/build blockers resolved slice (2026-03-11)

- what was built:
  - fixed BullMQ Redis connection typing by switching API/worker queue config to parsed connection options (instead of direct ioredis client instance typing conflict)
  - fixed dashboard Next build compatibility by moving config to `next.config.mjs` and aligning dashboard tsconfig for bundler resolution
  - added local ambient typing shims for unavailable external declarations (`pg`, `dockerode`, Next module surfaces used by dashboard)
  - validated workspace lint/typecheck/build now complete successfully in this environment
- files created or changed:
  - `apps/api/src/queue/redis.ts`
  - `apps/worker/src/queue/redis.ts`
  - `apps/api/src/queue/deployment-queue.ts`
  - `apps/dashboard/next.config.mjs`
  - `apps/dashboard/tsconfig.json`
  - `apps/dashboard/app/page.tsx`
  - `apps/api/src/types/external.d.ts`
  - `apps/worker/src/types/external.d.ts`
  - `apps/dashboard/types/next-shims.d.ts`
  - `.github/workflows/ci.yml`
  - `docs/progress.md`
  - `README.md`
- what is still missing:
  - real auth model (sessions/tokens/RBAC) beyond demo header boundary
  - bounded retention policy/archival strategy for deployment logs
  - optimistic project-create UX pending/disabled state polish
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - replace header-based demo auth with real session/token auth and RBAC


### Phase: CI checks pipeline baseline slice (2026-03-11)

- what was built:
  - added GitHub Actions workflow at `.github/workflows/ci.yml`
  - CI now runs install + workspace lint + workspace typecheck + workspace build on push/PR
  - surfaced current blocking issues directly in progress tracking for follow-up hardening
- files created or changed:
  - `.github/workflows/ci.yml`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
- what is still missing:
  - real auth model (sessions/tokens/RBAC) beyond demo header boundary
  - bounded retention policy/archival strategy for deployment logs
  - CI hardening follow-ups to resolve known type/build blockers
- known issues:
  - `ioredis` typing constructability mismatch currently breaks API/worker typecheck/build
  - dashboard Next runtime currently rejects `next.config.ts` in this environment, breaking dashboard build in CI
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - resolve workspace type/build blockers (ioredis typing + Next config compatibility) so CI turns fully green


### Phase: Worker failure-class retry tuning slice (2026-03-11)

- what was built:
  - worker now classifies known non-retryable deployment errors and short-circuits retries via BullMQ `UnrecoverableError`
  - retryable failures now log attempt/retries-left and only mark deployment failed after retry exhaustion
  - queue defaults tuned to 4 attempts with exponential backoff delay base of 5s
- files created or changed:
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/api/src/queue/deployment-queue.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
- what is still missing:
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
  - bounded retention policy/archival strategy for deployment logs
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add CI checks/tests pipeline for workspace typecheck/lint/build


### Phase: Dashboard project-create UX refinement slice (2026-03-11)

- what was built:
  - project create action now classifies API failure reasons (e.g. slug conflict vs generic API failure)
  - dashboard now shows targeted create error messages instead of a single generic failure banner
  - project create form now includes inline guidance for slug derivation/uniqueness behavior
  - API project create now maps slug uniqueness conflict to explicit 409 response
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add failure-class-aware retry tuning/backoff for worker deployment jobs


### Phase: Live log streaming slice (2026-03-11)

- what was built:
  - API now exposes deployment log SSE stream endpoint at `/v1/projects/:projectId/deployments/:deploymentId/logs/stream`
  - dashboard now includes a Next route proxy for stream auth and a client EventSource panel for live deployment logs
  - logs UI keeps existing static/polling behavior and adds live status + incremental tail updates
- files created or changed:
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/dashboard/components/logs-live-stream.tsx`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - improve dashboard project-create UX with inline validation and API error detail surfaces


### Phase: Minimal auth boundary slice (2026-03-11)

- what was built:
  - API now requires `x-user-id` header for project/deployment/env/log routes
  - project ownership checks added to block cross-project access for non-owners
  - dashboard API client now forwards demo user id as `x-user-id` for all requests
- files created or changed:
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/lib/api.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add true live log streaming path (websocket/sse/pubsub)


### Phase: DB migration workflow slice (2026-03-11)

- what was built:
  - established committed drizzle migration history under `apps/api/drizzle/`
  - added API script `db:migrate` to apply committed SQL migrations
  - updated runbooks/docs to make migration-first schema evolution the canonical team path
- files created or changed:
  - `apps/api/drizzle/0000_legal_texas_twister.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/drizzle/meta/0000_snapshot.json`
  - `apps/api/package.json`
  - `docs/database-schema.md`
  - `docs/progress.md`
  - `README.md`
- what is still missing:
  - minimal auth boundary for project/deployment ownership
  - true live log streaming transport (websocket/pubsub/sse)
  - failure-class-aware retry tuning/backoff for worker deployment jobs
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - dashboard typecheck/build still cannot run here due unresolved local Next dependency/tooling setup
- next recommended step:
  - add minimal auth boundary for project/deployment ownership


### Phase: Worker cleanup + idempotency guard slice (2026-03-11)

- what was built:
  - worker now removes stale deployment container name collisions before starting a run
  - failed runs now attempt container/image/workspace cleanup to reduce leaked resources
  - cleanup operations are non-fatal and logged with warning context so primary failure reason is preserved
- files created or changed:
  - `apps/worker/src/services/deployment-runner.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
- what is still missing:
  - failure-class-aware retry policy tuning and backoff per error type
  - true live log streaming transport (websocket/pubsub/sse)
  - auth boundary for real multi-user dashboard usage
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - dashboard typecheck/build still cannot run here due unresolved local Next dependency/tooling setup
- next recommended step:
  - add migration workflow (`drizzle generate` + committed SQL) for reproducible DB evolution


### Phase: Dashboard project creation vertical slice (2026-03-11)

- what was built:
  - dashboard New Project UI is now a real server-action form instead of a placeholder button
  - project creation is wired to API `POST /v1/projects` using demo user context
  - create flow includes deterministic slug generation from project name and success/error feedback banners
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `apps/dashboard/lib/api.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - auth boundary for real multi-user dashboard usage
  - stronger worker failure cleanup/idempotency coverage
- known issues:
  - typecheck/build cannot be fully validated in this environment due unresolved local Next/React module typing setup
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement worker cleanup/idempotency guards for failed deployments


### Phase: Dashboard env project selector vertical slice (2026-03-08)

- what was built:
  - environment variable editor now supports selecting which project to edit
  - selected project persists through save/delete env actions via query params
  - editor fetches and renders env vars for the chosen project in live mode
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
  - `README.md`
  - `apps/dashboard/README.md`
  - `docs/architecture.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - project creation workflow
  - auth boundary for real multi-user dashboard usage
- known issues:
  - typecheck/build cannot be fully validated in this environment due missing npm dependencies
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement project creation workflow in dashboard


### Phase: Dashboard logs polling + selector vertical slice (2026-03-08)

- what was built:
  - logs panel now supports selecting which recent deployment to inspect
  - optional 5-second auto-refresh polling added for logs view
  - deployment logs section updated with explicit apply controls and clearer refresh status
- files created or changed:
  - `apps/dashboard/components/logs-auto-refresh.tsx`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
  - `README.md`
  - `apps/dashboard/README.md`
  - `docs/architecture.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - env editor project selector (currently first project only)
  - project creation workflow
  - auth boundary for real multi-user dashboard usage
- known issues:
  - typecheck/build cannot be fully validated in this environment due missing npm dependencies
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add environment editor project selector in dashboard

### Phase: Dashboard logs viewer vertical slice (2026-03-08)

- what was built:
  - dashboard now fetches deployment logs from API for latest deployment in live mode
  - read-only logs panel added with timestamp/level/message rendering
  - logs panel includes fallback states when no deployment/logs are available
- files created or changed:
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
  - `README.md`
  - `apps/dashboard/README.md`
  - `docs/architecture.md`
- what is still missing:
  - logs live streaming/polling controls (current mode is page refresh)
  - env editor project selector (currently first project only)
  - project creation workflow
  - auth boundary for real multi-user dashboard usage
- known issues:
  - typecheck/build cannot be fully validated in this environment due missing npm dependencies
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add logs auto-refresh/polling control in dashboard and deployment selector

### Phase: Dashboard env editor vertical slice (2026-03-08)

- what was built:
  - dashboard environment variable section now performs list/add/delete against API endpoints
  - add and delete actions implemented using server actions with success/error feedback banners
  - env editor targets first available live project from demo user context
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `apps/dashboard/lib/api.ts`
  - `docs/progress.md`
  - `README.md`
  - `apps/dashboard/README.md`
  - `docs/architecture.md`
- what is still missing:
  - environment editor project selector (currently first project only)
  - deployment logs viewer and streaming
  - project creation workflow
  - auth boundary for real multi-user dashboard usage
- known issues:
  - typecheck/build cannot be fully validated in this environment due missing npm dependencies
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement deployment logs viewer vertical slice in dashboard

### Phase: Dashboard deploy trigger vertical slice (2026-03-08)

- what was built:
  - dashboard now performs read API integration for projects and deployments with mock fallback
  - deploy trigger action is wired from dashboard to `POST /v1/projects/:projectId/deployments`
  - user feedback banner added for deployment trigger success/failure
  - dashboard runtime is included in compose and routed by Caddy at `platform.example.com`
- files created or changed:
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/page.tsx`
  - `apps/dashboard/components/project-card.tsx`
  - `apps/dashboard/.env.example`
  - `apps/dashboard/Dockerfile`
  - `docker-compose.yml`
  - `infra/caddy/Caddyfile`
  - `README.md`
  - `apps/dashboard/README.md`
  - `docs/architecture.md`
  - `docs/progress.md`
- what is still missing:
  - project creation form wired to API
  - env var editor wired to API CRUD
  - deployment logs viewer and streaming
  - auth boundary for real multi-user dashboard usage
- known issues:
  - typecheck/build cannot be fully validated in this environment due missing npm dependencies
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement environment variable editor vertical slice in dashboard (list/add/remove via API)

---

## 1) Platform Foundation

- [x] Monorepo structure (`apps/*`, `packages/*`, `infra/*`, `docs/*`)
- [x] Workspace TypeScript configuration
- [x] Shared queue/types package (`packages/shared-types`)
- [x] Dockerfiles for API and Worker services

## 2) Core Infrastructure (Single Node)

- [x] Docker Compose stack for `api`, `worker`, `postgres`, `redis`, `caddy`
- [x] Optional `cloudflared` compose profile for tunnel ingress
- [x] Caddy base config + admin API exposure
- [~] Compose runbook/docs refined (still needs exact production-like run commands and troubleshooting section)

## 3) API Service (Control Plane)

- [x] Fastify bootstrap + health endpoint
- [x] Typed environment config via `zod` + `dotenv`
- [x] Project endpoints (create/list/get)
- [x] Deployment endpoints (create/list)
- [x] Environment variables CRUD endpoints
- [x] Deployment logs query endpoint
- [x] Queue publishing to BullMQ
- [~] Authentication/authorization (minimal header ownership boundary done; real auth still planned)

## 4) Database & Data Model

- [x] Drizzle schema for users/projects/deployments/env/logs/containers/domains
- [x] Drizzle config and DB client
- [x] Deployment metadata stores runtime config
- [x] Migration history/versioning strategy (committed drizzle SQL + metadata)

## 5) Worker Service (Execution Plane)

- [x] BullMQ worker consumer
- [x] Deployment pipeline skeleton: clone -> docker build -> docker run
- [x] Postgres status/log/container/domain updates
- [x] Caddy route upsert integration
- [x] Runtime limits support (port, memory, CPU) and non-root container user
- [~] Robust failure handling/cleanup (container/image cleanup, retries by failure class)
- [x] Full log streaming (live tail via SSE)

## 6) Security & Reliability

- [x] Env vars encrypted at rest in API storage path
- [x] Runtime resource controls in worker container creation
- [~] Secret management hardening (envelope encryption / key rotation)
- [ ] Auditing / RBAC / authn
- [ ] Rate limits and abuse controls

## 7) Dashboard (Phase 5)

- [x] Next.js dashboard scaffold
- [x] Project list/create UI (API-backed create + list)
- [x] Deploy trigger UI (basic trigger wired to deployment API)
- [x] Environment variable editor UI (project selector + list/add/delete wired to API)
- [x] Deployment history + logs viewer UI (deployment selector + optional polling refresh)

## 8) Observability & DX

- [x] Basic structured logging in worker
- [x] API request/error handling baseline
- [x] Unified structured logging format across all services
- [ ] Metrics and tracing
- [x] CI checks/tests pipeline (workflow present; workspace lint/typecheck/build baseline passing locally)

## 9) Testing Status

- [~] Static checks attempted in current environment
- [ ] End-to-end compose validation (blocked by missing Docker CLI in this environment)
- [ ] Typecheck/test execution with installed dependencies (blocked by npm registry restrictions in this environment)

---

## Immediate Next Recommended Steps

1. Add provider-native SDK/signing integrations for S3/GCS/Azure.
