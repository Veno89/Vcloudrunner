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

1. Configure environment variables:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/worker/.env.example apps/worker/.env
   cp apps/dashboard/.env.example apps/dashboard/.env
   ```
2. Provide compose secrets:
   ```bash
   export ENCRYPTION_KEY='replace-with-32-char-minimum-secret'
   export CLOUDFLARED_TOKEN='replace-with-cloudflare-tunnel-token'
   export NEXT_PUBLIC_DEMO_USER_ID='replace-with-existing-user-uuid'  # optional for live dashboard data
   ```
3. Build and start core local platform stack:
   ```bash
   docker compose up -d --build
   ```
4. (Optional) Start Cloudflare tunnel profile:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```
5. Apply committed migrations (from host):
   ```bash
   npm install
   npm --workspace @vcloudrunner/api run db:migrate
   ```

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
- `POST /v1/projects`
- `GET /v1/users/:userId/projects`
- `GET /v1/users/:userId/api-tokens`
- `POST /v1/users/:userId/api-tokens`
- `DELETE /v1/users/:userId/api-tokens/:tokenId`
- `GET /v1/projects/:projectId`
- `POST /v1/projects/:projectId/deployments`
- `GET /v1/projects/:projectId/deployments`
- `GET /v1/projects/:projectId/environment-variables`
- `PUT /v1/projects/:projectId/environment-variables`
- `DELETE /v1/projects/:projectId/environment-variables/:key`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs/stream`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs/export`


## Minimal Auth Boundary (MVP)

- All `/v1` project-scoped endpoints require `Authorization: Bearer <token>`.
- API resolves auth context from DB-backed `api_tokens` first (supports revocation/expiry), with `API_TOKENS_JSON` fallback for bootstrap/dev compatibility.
- `admin` role can access all projects; `user` role is limited to owned projects.
- Dashboard server-side API calls use `API_AUTH_TOKEN` when configured.


## Deployment Retry Semantics

- Deployment jobs use exponential backoff retries for transient failures.
- Worker classifies known non-retryable failures (e.g., git auth/repo access and invalid Dockerfile paths) and fails fast without exhausting retries.


## CI

- GitHub Actions workflow added at `.github/workflows/ci.yml`.
- Pipeline runs install, workspace lint, workspace typecheck, and workspace build.
- Baseline workspace lint/typecheck/build passes locally; see `docs/progress.md` for remaining non-CI blockers.


## Deployment Log Retention

- Worker enforces a per-deployment log cap (`DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT`, default `2000`).
- Worker also prunes logs older than retention window (`DEPLOYMENT_LOG_RETENTION_DAYS`, default `14`) on a background interval (`DEPLOYMENT_LOG_PRUNE_INTERVAL_MS`).
- Logs can be exported before pruning via API NDJSON export endpoint (`/v1/projects/:projectId/deployments/:deploymentId/logs/export`) in `ndjson` or `ndjson.gz` format, or dashboard proxy (`/api/log-export`).
- Worker now runs a scheduled filesystem archival sweep for completed deployments (`DEPLOYMENT_LOG_ARCHIVE_DIR`, `DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS`).
- Optional archive upload sweeps can push `.ndjson.gz` archives via provider-specific adapters (`http`, `s3`, `gcs`, `azure`) using `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_PROVIDER` + provider settings, with optional bearer auth token, upload interval/timeout, retry/backoff controls, and optional local-delete after upload.
- Worker cleanup lifecycle controls can prune old local archive artifacts/markers on an interval (`DEPLOYMENT_LOG_ARCHIVE_CLEANUP_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_LOCAL_MAX_AGE_DAYS`, `DEPLOYMENT_LOG_ARCHIVE_MARKER_MAX_AGE_DAYS`).
