# Vcloudrunner

Single-node self-hosted PaaS MVP monorepo. Think "a small Railway/Vercel-style platform that runs on one machine".

## Start Here (Noob-Friendly)

Vcloudrunner takes a Git repository, builds it in Docker, runs it on the same machine, and gives you a dashboard to manage projects, deployments, environment variables, logs, health, and API tokens.

What you can do with it today:

- create projects that point at Git repos
- store per-project environment variables
- provision managed Postgres resources with generated credentials, linked-service env injection, persisted runtime health, reconcile/rotation controls, external backup runbooks, backup/restore operation journaling, backup artifact inventory, artifact lifecycle controls, restore request approval tracking, audit export, due-state visibility, and project-scoped delete controls
- trigger deployments and watch logs
- manage custom domains with TXT claim checks, DNS/TLS diagnostics, certificate guidance, presented-chain visibility, last-healthy issuer-path snapshots, intermediate-certificate validity surfacing, chain recovery history, certificate rotation telemetry, persistent certificate issue surfacing, and event-backed certificate trust / issuer-path recovery history
- see queue / worker / API health from the dashboard
- manage API tokens for dashboard and API access
- invite project members with claim links, ownership transfer, and optional outbound invite-delivery webhook automation

Important current limitations:

- this is still an MVP aimed at local/self-hosted development, not a polished hosted SaaS
- there is no sign-up / login UI yet
- if `NEXT_PUBLIC_DEMO_USER_ID` and `API_AUTH_TOKEN` are not configured, the dashboard still loads, but user-scoped pages intentionally show explicit live-data unavailable guidance
- local deployed-app URLs under `*.apps.platform.example.com` need matching DNS or tunnel setup; the dashboard and API hostnames are the easiest things to test first

## Fastest Way To Try It

1. Create a root `.env` file in the repo with at least:
   ```dotenv
   ENCRYPTION_KEY=replace-with-32-char-minimum-secret
   POSTGRES_PASSWORD=replace-with-strong-postgres-password
   REDIS_PASSWORD=replace-with-strong-redis-password
   CLOUDFLARED_TOKEN=
   NEXT_PUBLIC_DEMO_USER_ID=
   API_AUTH_TOKEN=
   ```
   `NEXT_PUBLIC_DEMO_USER_ID` and `API_AUTH_TOKEN` are optional. Leave them blank if you just want to bring the stack up and inspect the dashboard shell plus platform health first.
2. Install dependencies and start the compose stack:
   ```bash
   npm install
   docker compose up -d --build
   ```
3. Apply the committed database migrations from the host workspace:
   ```bash
   npm --workspace @vcloudrunner/api run db:migrate
   ```
   If the API or worker booted before the schema existed, rerun:
   ```bash
   docker compose restart api worker dashboard
   ```
4. Add these local hostnames to your hosts file:
   ```text
   127.0.0.1 platform.example.com
   127.0.0.1 api.platform.example.com
   ```
5. Open the platform:
   - dashboard: `http://platform.example.com`
   - API health: `http://api.platform.example.com/health`
   - note: `http://localhost` only returns the Caddy placeholder response, not the dashboard UI
6. Optional: start the Cloudflare tunnel profile if you want external ingress:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```

## How To Use It Once It Is Running

If you have configured a live user/token or the local-only dev bootstrap, this is the normal flow:

1. Open the dashboard.
2. Check the status page first so you know the API, queue, and worker are healthy.
3. Create a project with a Git repository URL and branch.
4. Add environment variables if your app needs them.
5. Trigger a deployment and watch the logs.
6. Open the runtime URL after the deployment is running and local DNS / tunnel routing exists for that app hostname.
7. Use the token settings page, or the `/v1/users/:userId/api-tokens` endpoints, to move from bootstrap/local shortcuts to DB-backed tokens.

## Local Development (Run The Apps On Your Machine)

If you want to run Next.js / Fastify / the worker directly on your machine instead of inside containers:

- on plain Windows, the full compose path is usually the easiest option; the host-run worker defaults are most comfortable on Linux, macOS, or WSL2 because they assume a Unix Docker socket path
- copy the app-local env examples first

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/worker/.env.example apps/worker/.env
Copy-Item apps/dashboard/.env.example apps/dashboard/.env
```

Bash / zsh:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/dashboard/.env.example apps/dashboard/.env
```

- if you are reusing this repo's compose Postgres from the host, change `DATABASE_URL` in both `apps/api/.env` and `apps/worker/.env` to `postgres://postgres:postgres@localhost:55432/vcloudrunner`
- the shipped app-local examples use `localhost:5432`, which assumes a separate host Postgres instance instead of the compose-exposed one
- for the simplest local-only admin bootstrap, set `ENABLE_DEV_AUTH=true` in `apps/api/.env`, set `NEXT_PUBLIC_DEMO_USER_ID=00000000-0000-0000-0000-000000000001` in `apps/dashboard/.env`, leave `API_AUTH_TOKEN` empty, and create the matching dev user row:

```bash
docker compose exec postgres psql -U postgres -d vcloudrunner -c "INSERT INTO users (id, email, name) VALUES ('00000000-0000-0000-0000-000000000001', 'dev@example.com', 'Local Dev Admin') ON CONFLICT (email) DO NOTHING;"
```

- then start the apps in separate terminals:

```bash
npm run dev:api
npm run dev:worker
npm run dev:dashboard
```

- open `http://localhost:3001`
- for production-like local runs, keep `ENABLE_DEV_AUTH=false` and use a real DB-backed token in `API_AUTH_TOKEN`

## Database / Env Notes

- apply committed schema changes with:
  ```bash
  npm --workspace @vcloudrunner/api run db:migrate
  ```
- generate new migration files with:
  ```bash
  npm --workspace @vcloudrunner/api run db:generate
  ```
- the API runtime and `drizzle-kit` commands load env files in this order: repo root `.env` first, then `apps/api/.env` as an override
- the worker follows the same pattern with repo root `.env` first, then `apps/worker/.env`
- `REDIS_URL` defaults to Redis database `0` when no path is present, but any explicit path must be a single integer database index like `redis://localhost:6379/0`
- invitation delivery can stay manual via claim links, or you can configure:
  - `INVITATION_CLAIM_BASE_URL` for the public dashboard base used in generated invite links
  - `INVITATION_DELIVERY_WEBHOOK_URL` for a best-effort outbound delivery hook
  - `INVITATION_DELIVERY_WEBHOOK_AUTH_TOKEN` for optional bearer auth on that webhook
- when the invitation-delivery webhook is configured, the API posts pending-invite payloads plus the claim URL on create/redelivery; if delivery is disabled or fails, the invitation is still stored and can be shared manually from the dashboard
- managed Postgres provisioning is enabled when the API has:
  - `MANAGED_POSTGRES_ADMIN_URL` pointing at a Postgres admin connection that can create roles/databases
  - `MANAGED_POSTGRES_RUNTIME_HOST` / `MANAGED_POSTGRES_RUNTIME_PORT` describing how deployed app containers should reach that Postgres service
  - optional `MANAGED_POSTGRES_RUNTIME_SSL_MODE` set to `disable`, `prefer`, or `require`
- managed Postgres reconcile now re-checks runtime connectivity with the generated service credentials after provisioning work completes, so the dashboard can distinguish “provisioned” from “runtime healthy”
- managed Postgres credential rotation is available from the dashboard/API, but linked services still need a redeploy after rotation so they receive the new generated password
- managed Postgres now persists external backup mode/cadence, runbook notes, backup and restore operation history, backup artifact inventory, artifact lifecycle state, restore request approval history, verification timestamps, due/attention status, audit-export data, and recent database activity history in the dashboard/API
- managed Postgres backup execution, backup retention enforcement, approval ownership, and restore execution are not automated yet; keep an external backup process and restore runbook in place for any database you care about
- the compose stack now wires those managed-Postgres envs for the bundled single-node Postgres service and pins the default Docker network name to `vcloudrunner-platform`, which is the shared runtime network the worker uses when injecting managed Postgres connection strings into deployed containers

## MVP Infrastructure Model

The MVP intentionally runs on **one machine** using Docker Engine and Docker Compose.

Traffic path:

`Cloudflare Edge -> cloudflared -> Caddy -> API/deployed containers`

No Kubernetes or multi-node orchestration is introduced in the MVP.

## Implemented so far

### Control + Execution Plane
- Fastify API for projects, deployments, env vars, logs, tokens, health, and metrics
- BullMQ/Redis deployment queue
- Worker service for `clone -> build -> run`
- Caddy route upsert integration from worker
- Dashboard for status, projects, deployments, logs, environment variables, and token management
- Deployment logs viewer with live SSE stream, export, reconnect handling, and terminal-state-aware fallbacks

### Data + Runtime
- Drizzle PostgreSQL schema for platform entities
- Docker-based deployment runtime
- managed Postgres control-plane resource model with generated credentials, linked-service env injection, persisted runtime health, credential rotation, recovery scaffolding, manual backup/restore operation journaling, backup artifact inventory, artifact lifecycle controls, restore request approval scaffolding, and audit export
- Environment variable encryption at rest (API)

### Local Infrastructure
- `docker-compose` stack for: `dashboard`, `api`, `worker`, `postgres`, `redis`, `caddy` (+ optional `cloudflared` profile)
- Cloudflared tunnel scaffolding for public ingress without router port-forwarding

## Deployment Runtime Defaults

Deployments now support runtime tuning (optional per deploy request):

- `containerPort` (default from `DEPLOYMENT_DEFAULT_CONTAINER_PORT`)
- `memoryMb` (default from `DEPLOYMENT_DEFAULT_MEMORY_MB`)
- `cpuMillicores` (default from `DEPLOYMENT_DEFAULT_CPU_MILLICORES`)

These are injected into worker jobs and applied as Docker resource/runtime settings.

## Progress Tracking

- See `docs/progress.md` for a live checklist of done vs remaining MVP tasks.
- See `docs/roadmap.md` for the product roadmap and planned feature direction, including multi-service apps and managed databases.

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
- `GET /v1/projects/:projectId/databases`
- `GET /v1/projects/:projectId/databases/:databaseId/audit/export`
- `POST /v1/projects/:projectId/databases`
- `POST /v1/projects/:projectId/databases/:databaseId/reconcile`
- `POST /v1/projects/:projectId/databases/:databaseId/rotate-credentials`
- `PUT /v1/projects/:projectId/databases/:databaseId/backup-policy`
- `POST /v1/projects/:projectId/databases/:databaseId/recovery-checks`
- `POST /v1/projects/:projectId/databases/:databaseId/backup-artifacts`
- `PUT /v1/projects/:projectId/databases/:databaseId/backup-artifacts/:backupArtifactId`
- `POST /v1/projects/:projectId/databases/:databaseId/restore-requests`
- `PUT /v1/projects/:projectId/databases/:databaseId/restore-requests/:restoreRequestId/approval`
- `PUT /v1/projects/:projectId/databases/:databaseId/restore-requests/:restoreRequestId`
- `PUT /v1/projects/:projectId/databases/:databaseId/service-links`
- `DELETE /v1/projects/:projectId/databases/:databaseId`
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
- Boolean env flags like `ENABLE_DEV_AUTH`, `TRUST_PROXY`, `CORS_ALLOW_CREDENTIALS`, and `OTEL_ENABLED` now parse `.env` string values strictly, so explicit values like `false`, `0`, `no`, and `off` stay disabled while truthy forms like `true`, `1`, `yes`, and `on` are honored consistently.
- Numeric env settings like `PORT`, `*_MS`, `*_MB`, `*_DAYS`, and retry/threshold counts now parse string values strictly too, so blank strings fall back to documented defaults while malformed numeric values fail fast at startup.
- The compose quick-start path now pins `ENABLE_DEV_AUTH` off even if a local root `.env` enables it for host-run development.
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
