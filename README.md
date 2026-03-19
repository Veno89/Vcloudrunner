# Vcloudrunner

Railway-style single-node PaaS MVP monorepo.

## MVP Infrastructure Model

The MVP intentionally runs on **one machine** using Docker Engine and Docker Compose.

Traffic path:

`Cloudflare Edge -> cloudflared -> Caddy -> API/deployed containers`

No Kubernetes or multi-node orchestration is introduced in the MVP.

## Implemented so far

### Control + Execution Plane
- Fastify API for projects, deployments, env vars, and logs
- BullMQ/Redis deployment queue
- Worker service for `clone -> build -> run`
- Caddy route upsert integration from worker
- Dashboard project list/create integration + deploy action from dashboard
- Environment variable editor vertical slice in dashboard (project selector + CRUD)
- Deployment logs viewer with live SSE stream (deployment selector + server-proxied EventSource)

### Data + Runtime
- Drizzle PostgreSQL schema for platform entities
- Docker-based deployment runtime
- Environment variable encryption at rest (API)

### Local Infrastructure
- `docker-compose` stack for: `dashboard`, `api`, `worker`, `postgres`, `redis`, `caddy` (+ optional `cloudflared` profile)
- Cloudflared tunnel scaffolding for public ingress without router port-forwarding

## Quick Start

1. Provide the required `docker compose` environment variables in your shell or a root `.env` file:
   ```bash
   export ENCRYPTION_KEY='replace-with-32-char-minimum-secret'  # required
   export POSTGRES_PASSWORD='replace-with-strong-postgres-password'  # required
   export REDIS_PASSWORD='replace-with-strong-redis-password'  # required
   export CLOUDFLARED_TOKEN='replace-with-cloudflare-tunnel-token'
   export NEXT_PUBLIC_DEMO_USER_ID='replace-with-existing-user-uuid'  # optional; leave unset until you have a real user ID for live dashboard user-scoped pages
   export API_AUTH_TOKEN='replace-with-db-backed-api-token'  # optional; needed for live dashboard API calls
   ```
   Keep `ENABLE_DEV_AUTH` unset/`false` and leave `API_TOKENS_JSON` empty for this production-like compose path. If `NEXT_PUBLIC_DEMO_USER_ID` is unset, the dashboard now stays up and shows explicit live-data unavailable guidance instead of pretending a placeholder user exists.
2. Build and start the core platform stack:
   ```bash
   docker compose up -d --build
   ```
3. Apply committed migrations from the host workspace:
   ```bash
   npm install
   npm --workspace @vcloudrunner/api run db:migrate
   ```
   The API runtime and `drizzle-kit` commands now use the same env-file loading order: root `.env` first, then `apps/api/.env` as an override. `db:migrate` now fails fast if `DATABASE_URL` is missing instead of silently falling back to a local default database.
4. (Optional) Start the Cloudflare tunnel profile:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```
5. For direct host-run development instead of compose, copy the app-local examples:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/worker/.env.example apps/worker/.env
   cp apps/dashboard/.env.example apps/dashboard/.env
   ```
   The API, its `drizzle-kit` commands, and the worker load the root `.env` first and then their app-local `.env` files as an override for host-run development. `apps/api/.env.example` keeps `API_TOKENS_JSON` as a bootstrap/dev-only fallback and will emit a startup warning when used. `ENABLE_DEV_AUTH` remains an explicit opt-in bypass.

6. For future schema changes, generate and commit SQL migration files:
   ```bash
   npm --workspace @vcloudrunner/api run db:generate
   ```

7. Run dashboard locally:
   ```bash
   npm run dev:dashboard
   ```


## Deployment Runtime Defaults

Deployments now support runtime tuning (optional per deploy request):

- `containerPort` (default from `DEPLOYMENT_DEFAULT_CONTAINER_PORT`)
- `memoryMb` (default from `DEPLOYMENT_DEFAULT_MEMORY_MB`)
- `cpuMillicores` (default from `DEPLOYMENT_DEFAULT_CPU_MILLICORES`)

These are injected into worker jobs and applied as Docker resource/runtime settings.

## Progress Tracking

- See `docs/progress.md` for a live checklist of done vs remaining MVP tasks.

## API Endpoints

- `GET /health`
- `GET /health/queue`
- `GET /health/worker`
- `GET /metrics/queue`
- `GET /metrics/worker`
- `POST /v1/projects`
- `GET /v1/users/:userId/projects`
- `GET /v1/users/:userId/api-tokens`
- `POST /v1/users/:userId/api-tokens`
- `POST /v1/users/:userId/api-tokens/:tokenId/rotate`
- `DELETE /v1/users/:userId/api-tokens/:tokenId`
- `GET /v1/projects/:projectId`
- `POST /v1/projects/:projectId/deployments`
- `GET /v1/projects/:projectId/deployments`
- `POST /v1/projects/:projectId/deployments/:deploymentId/cancel` (queued/building deployments; completes immediately only when the queued job can still be removed)
- `GET /v1/projects/:projectId/environment-variables`
- `PUT /v1/projects/:projectId/environment-variables`
- `DELETE /v1/projects/:projectId/environment-variables/:key`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs/stream`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs/export`


## Minimal Auth Boundary (MVP)

- All `/v1` project-scoped endpoints require `Authorization: Bearer <token>`.
- API resolves auth context from DB-backed `api_tokens` (SHA-256 token hash + revocation/expiry checks) first, with `API_TOKENS_JSON` available only as a bootstrap/dev fallback.
- Any non-empty `API_TOKENS_JSON` emits a startup warning; production startup rejects `API_TOKENS_JSON` and `ENABLE_DEV_AUTH=true`.
- Bootstrap `API_TOKENS_JSON` entries must be a valid JSON array with unique token values; malformed or duplicate entries now fail startup explicitly.
- When `ENABLE_DEV_AUTH=true`, the local bypass only applies when auth credentials are absent; invalid or malformed `Authorization` headers now fail explicitly instead of silently falling back to admin.
- Boolean env flags like `ENABLE_DEV_AUTH`, `TRUST_PROXY`, and `CORS_ALLOW_CREDENTIALS` now parse `.env` string values strictly, so explicit values like `false`, `0`, `no`, and `off` stay disabled instead of being treated as truthy.
- The compose quick-start path keeps `ENABLE_DEV_AUTH` disabled by default.
- `admin` role can access all projects; `user` role can access owned projects plus projects granted through `project_members`.
- API tokens now support explicit scope sets (e.g. `projects:read`, `deployments:write`, `logs:read`, `tokens:write`) with route-level scope guards.
- Existing legacy tokens without scope metadata are normalized to compatibility defaults during auth resolution.
- Dashboard server-side API calls use `API_AUTH_TOKEN` when configured.


## API Ingress Hardening

- CORS is now explicit allowlist-based via `CORS_ALLOWED_ORIGINS` (comma-separated origins) instead of permissive wildcard behavior.
- CORS credentials behavior is controlled by `CORS_ALLOW_CREDENTIALS`.
- `TRUST_PROXY=true` should be enabled whenever the API sits behind Caddy/cloudflared or another trusted reverse proxy so rate limiting and allowlists key off the forwarded client IP instead of the proxy hop.
- Global API rate limiting is enabled via `@fastify/rate-limit` using:
   - `API_RATE_LIMIT_MAX`
   - `API_RATE_LIMIT_WINDOW_MS`
   - `API_RATE_LIMIT_ALLOWLIST` (comma-separated client IPs)
  In the compose stack this now works against the real client IP because the API service explicitly enables trusted-proxy handling behind Caddy.


## Operational Alert Hooks

- API can emit webhook alerts for degraded worker heartbeat and queue anomaly thresholds.
- Configure webhook delivery with:
   - `ALERT_WEBHOOK_URL`
   - `ALERT_WEBHOOK_AUTH_TOKEN` (optional bearer token)
- Configure monitor cadence and alert dedupe with:
   - `ALERT_MONITOR_INTERVAL_MS`
   - `ALERT_COOLDOWN_MS`
- Configure queue anomaly thresholds with:
   - `ALERT_QUEUE_WAITING_THRESHOLD`
   - `ALERT_QUEUE_ACTIVE_THRESHOLD`
   - `ALERT_QUEUE_FAILED_THRESHOLD`


## Deployment Retry Semantics

- Deployment jobs use exponential backoff retries for transient failures.
- Worker classifies known non-retryable failures (e.g., git auth/repo access and invalid Dockerfile paths) and fails fast without exhausting retries.
- Worker enforces `DEPLOYMENT_EXECUTION_TIMEOUT_MS` to bound hangs and fail deployments that exceed runtime budget.
- Worker runs periodic stuck-deployment recovery (`DEPLOYMENT_STUCK_RECOVERY_INTERVAL_MS`) and auto-fails stale `queued`/`building` deployments based on configurable max age thresholds (`DEPLOYMENT_STUCK_QUEUED_MAX_AGE_MINUTES`, `DEPLOYMENT_STUCK_BUILDING_MAX_AGE_MINUTES`).
- Worker publishes a Redis heartbeat (`WORKER_HEARTBEAT_KEY`) on a fixed cadence (`WORKER_HEARTBEAT_INTERVAL_MS`, TTL via `WORKER_HEARTBEAT_TTL_SECONDS`) consumed by API health/metrics endpoints.
- Worker runtime execution now goes through an abstraction layer (`RuntimeExecutor`) with env-selectable adapter (`DEPLOYMENT_RUNTIME_EXECUTOR`, currently `docker`).


## CI

- GitHub Actions workflow added at `.github/workflows/ci.yml`.
- Pipeline runs install, workspace lint, workspace typecheck, and workspace build.
- Baseline workspace lint/typecheck/build passes locally; see `docs/progress.md` for remaining non-CI blockers.


## Deployment Log Retention

- Worker enforces a per-deployment log cap (`DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT`, default `2000`).
- Worker also prunes logs older than retention window (`DEPLOYMENT_LOG_RETENTION_DAYS`, default `14`) on a background interval (`DEPLOYMENT_LOG_PRUNE_INTERVAL_MS`).
- Logs can be exported before pruning via API NDJSON export endpoint (`/v1/projects/:projectId/deployments/:deploymentId/logs/export`) in `ndjson` or `ndjson.gz` format, or dashboard proxy (`/api/log-export`).
- Worker now runs a scheduled filesystem archival sweep for completed deployments (`DEPLOYMENT_LOG_ARCHIVE_DIR`, `DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS`).
- Optional archive upload sweeps can push `.ndjson.gz` archives via provider-specific adapters (`http`, `s3`, `gcs`, `azure`) using `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER` + provider settings, now including provider-native auth/signing modes (S3 SigV4 headers, GCS bearer token or service-account OAuth flow, Azure Blob SharedKey), plus upload interval/timeout, retry/backoff controls, and optional local-delete after upload.
- Worker cleanup lifecycle controls can prune old local archive artifacts/markers on an interval (`DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS`, `DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS`).
