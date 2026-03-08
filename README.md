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
- Dashboard read integration + basic deploy action from dashboard
- Environment variable editor vertical slice in dashboard
- Deployment logs viewer vertical slice in dashboard

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
5. Push schema (from host):
   ```bash
   npm install
   npm --workspace @vcloudrunner/api run db:push
   ```
6. Run dashboard locally:
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
- `GET /v1/projects/:projectId`
- `POST /v1/projects/:projectId/deployments`
- `GET /v1/projects/:projectId/deployments`
- `GET /v1/projects/:projectId/environment-variables`
- `PUT /v1/projects/:projectId/environment-variables`
- `DELETE /v1/projects/:projectId/environment-variables/:key`
- `GET /v1/projects/:projectId/deployments/:deploymentId/logs`
