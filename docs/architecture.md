# Vcloudrunner MVP Architecture

## Guiding Constraints

- Single-node deployment for MVP (one physical machine).
- No Kubernetes or orchestration frameworks in MVP.
- All core services run locally using Docker Compose.
- Architecture remains modular so each service can later move to independent hosts.

## Core Services (MVP)

1. **API Service** (`apps/api`)
   - project/deployment/env/log APIs
   - deployment record creation
   - queue publishing
2. **Worker Service** (`apps/worker`)
   - deployment execution pipeline (`clone -> build -> run`)
   - applies runtime limits (port/memory/cpu) from deployment payload defaults or overrides
   - route update calls to Caddy Admin API
   - deployment status/log/container/domain updates
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

## Ingress Flow

`Internet -> Cloudflare Edge -> cloudflared -> caddy -> api/app containers`

## Future Migration Compatibility

- Worker is stateless and queue-driven (scale out by adding workers later).
- API remains control-plane only (no build/runtime coupling).
- Caddy integration encapsulated in worker service for easier proxy replacement.


## UI Status

- `apps/dashboard` now has a Next.js scaffold with project/deployment overview shells.
- Dashboard now has read integration for projects/deployments, basic deploy trigger action, environment variable editor CRUD for selected project, and a read-only latest-deployment logs viewer; live log streaming and selectors remain in progress.

- dashboard is now included in compose runtime and served via `platform.example.com` through Caddy.
