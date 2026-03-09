# Vcloudrunner MVP Progress Tracker

Last updated: 2026-03-08 (dashboard env project selector vertical slice)

## Legend

- [x] Done
- [~] In progress / partial
- [ ] Not started


## Implementation Log

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
- [~] Authentication/authorization (planned)

## 4) Database & Data Model

- [x] Drizzle schema for users/projects/deployments/env/logs/containers/domains
- [x] Drizzle config and DB client
- [x] Deployment metadata stores runtime config
- [ ] Migration history/versioning strategy (currently schema push oriented)

## 5) Worker Service (Execution Plane)

- [x] BullMQ worker consumer
- [x] Deployment pipeline skeleton: clone -> docker build -> docker run
- [x] Postgres status/log/container/domain updates
- [x] Caddy route upsert integration
- [x] Runtime limits support (port, memory, CPU) and non-root container user
- [~] Robust failure handling/cleanup (container/image cleanup, retries by failure class)
- [ ] Full log streaming (live tail via websocket/pubsub)

## 6) Security & Reliability

- [x] Env vars encrypted at rest in API storage path
- [x] Runtime resource controls in worker container creation
- [~] Secret management hardening (envelope encryption / key rotation)
- [ ] Auditing / RBAC / authn
- [ ] Rate limits and abuse controls

## 7) Dashboard (Phase 5)

- [x] Next.js dashboard scaffold
- [~] Project list/create UI (read-only API wiring done; create action pending)
- [x] Deploy trigger UI (basic trigger wired to deployment API)
- [x] Environment variable editor UI (project selector + list/add/delete wired to API)
- [x] Deployment history + logs viewer UI (deployment selector + optional polling refresh)

## 8) Observability & DX

- [x] Basic structured logging in worker
- [x] API request/error handling baseline
- [ ] Unified structured logging format across all services
- [ ] Metrics and tracing
- [ ] CI checks/tests pipeline

## 9) Testing Status

- [~] Static checks attempted in current environment
- [ ] End-to-end compose validation (blocked by missing Docker CLI in this environment)
- [ ] Typecheck/test execution with installed dependencies (blocked by npm registry restrictions in this environment)

---

## Immediate Next Recommended Steps

1. Implement project creation workflow in dashboard.
2. Add worker cleanup/idempotency guards for failed deployments.
3. Add migration workflow (`drizzle generate` + committed SQL) for reproducible DB evolution.
4. Add minimal auth boundary for project/deployment ownership.
5. Add true live log streaming path (websocket/sse/pubsub).
