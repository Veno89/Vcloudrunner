# Vcloudrunner MVP Architecture

## Guiding Constraints

- Single-node deployment for MVP (one physical machine).
- No Kubernetes or orchestration frameworks in MVP.
- All core services run locally using Docker Compose.
- Architecture remains modular so each service can later move to independent hosts.

## Core Services (MVP)

1. **API Service** (`apps/api`)
   - project/deployment/env/log APIs with minimal bearer-token ownership boundary (`Authorization` + token claims)
   - deployment record creation
   - queue publishing
   - centralized error handling: all `DomainError` subclasses carry a `statusCode` and are automatically mapped to HTTP responses by the error-handler plugin (routes throw, plugin catches)
   - graceful shutdown via SIGTERM/SIGINT (drains connections, closes Redis/queue)
   - dev auth bypass gated by explicit `ENABLE_DEV_AUTH` flag (default false)
2. **Worker Service** (`apps/worker`)
   - deployment execution pipeline (`clone -> build -> run`)
   - applies runtime limits (port/memory/cpu) from deployment payload defaults or overrides
   - route update calls to Caddy Admin API
   - deployment status/log/container/domain updates
   - bounded deployment-log retention (per-deployment cap + time-window pruning)
   - provider-aware archive upload auth/signing (S3 SigV4, GCS OAuth bearer, Azure SharedKey)
   - failure-class-aware retry behavior (retry transient failures, short-circuit non-retryable failures)
3. **Reverse Proxy** (`caddy`)
   - local routing for `platform`, `api`, and app subdomains
   - dynamic route updates from worker
4. **Database** (`postgres`)
   - source of truth for projects, deployments, env vars, domains, logs metadata
5. **Queue** (`redis` + BullMQ)
   - asynchronous deployment jobs with retry support
6. **Tunnel Connector** (`cloudflared`, optional compose profile)
   - secure outbound tunnel from local machine to Cloudflare edge

## Runtime Layout (Single Node)

Host machine runs Docker Engine with:

- api
- worker
- postgres
- redis
- caddy
- cloudflared (optional profile for external ingress)
- deployed app containers (created by worker)

## Operational Notes

- `api` and `worker` are containerized with dedicated Dockerfiles (build once, run many).
- Compose health checks gate startup for `postgres`, `redis`, and `api` dependencies.
- Worker mounts Docker socket for single-node runtime container control.
- Worker run path includes stale-container pre-cleanup and failed-run cleanup attempts (container/image/workspace) to reduce leaked local resources.

## Ingress Flow

`Internet -> Cloudflare Edge -> cloudflared -> caddy -> api/app containers`

## Future Migration Compatibility

- CI workflow runs workspace lint/typecheck/build on pushes and pull requests (baseline quality gate).



- Worker is stateless and queue-driven (scale out by adding workers later).
- API remains control-plane only (no build/runtime coupling).
- Caddy integration encapsulated in worker service for easier proxy replacement.


## UI Status

- `apps/dashboard` now has a Next.js scaffold with project/deployment overview shells.
- Dashboard now has read/create integration for projects, basic deploy trigger action, environment variable editor CRUD for selected project, and a deployment logs viewer with deployment selector plus polling and SSE-based live streaming.
- Dashboard API token panel supports list/create/revoke/rotate operations and one-time plaintext token reveal on create/rotate for safe copy workflows.

- dashboard is now included in compose runtime and served via `platform.example.com` through Caddy.
