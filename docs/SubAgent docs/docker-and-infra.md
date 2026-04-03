# Docker and Infrastructure

Reference for subagents working on Docker, Compose, Caddy, networking, or container operations.

---

## Docker Compose Services

All services are defined in `docker-compose.yml` at the repo root.

| Service | Image | Internal Port | External Port | Purpose |
|---------|-------|---------------|---------------|---------|
| `api` | `vcloudrunner-api` (built) | 4000 | — | REST API |
| `worker` | `vcloudrunner-worker` (built) | — | — | Deployment job processor |
| `dashboard` | `vcloudrunner-dashboard` (built) | 3001 | — | Next.js web UI |
| `postgres` | `postgres:16-alpine` | 5432 | 55432 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | — | Queue backend |
| `caddy` | `caddy:2.8` | 80, 443, 2019 | 80, 443 | Reverse proxy |
| `cloudflared` | `cloudflare/cloudflared` | — | — | Optional tunnel (profile: `tunnel`) |

### Networks

- **`vcloudrunner-platform`** — shared network for all Compose services (pinned name in `docker-compose.yml`)
- **`vcloudrunner-deployments`** — network for deployed user containers; worker creates this on startup

### Volumes

- `postgres_data` — persistent PostgreSQL data
- `redis_data` — persistent Redis data
- `caddy_data` / `caddy_config` — Caddy certificates and config

### Health Checks

- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- API: `wget --spider http://localhost:4000/health`
- Dashboard: `wget --spider http://localhost:3001`

Compose uses `depends_on` + `condition: service_healthy` to gate startup order.

---

## Dockerfiles

All three app Dockerfiles follow the same **multi-stage pattern**:

```
Stage 1: base (node:20-alpine)
  → WORKDIR /workspace
  → Copy package.json files (root + workspace)
  → npm install
  → Copy source
  → Build (tsc / next build)

Stage 2: runtime (node:20-alpine)
  → Copy dist, node_modules, package.json from base
  → CMD npm start
```

### Worker-Specific

Worker's Dockerfile additionally installs:
- `git` — for cloning repositories
- `docker-cli` — for talking to Docker Engine via dockerode

### Dashboard-Specific

Dashboard builds with `next build` and runs with `next start -p 3001`.

---

## Caddy Configuration

### Static Config (`infra/caddy/Caddyfile`)

Caddy is configured with:
- Auto HTTPS disabled for local dev (`auto_https off`)
- Admin API on `:2019`
- HTTP on `:80`
- Static routes for `api` and `dashboard` services

### Dynamic Routes (Caddy Admin API)

The worker manages routes for deployed containers via the Caddy admin API at `http://caddy:2019`:

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Update existing route | `PUT` | `/id/{routeId}` |
| Get all routes | `GET` | `/config/apps/http/servers/srv0/routes` |
| Replace all routes | `PATCH` | `/config/apps/http/servers/srv0/routes` |
| Delete route | `DELETE` | `/id/{routeId}` |

### Route Payload Structure

```json
{
  "@id": "vcloudrunner-route-<host>",
  "match": [{ "host": ["<host>"] }],
  "handle": [
    {
      "handler": "reverse_proxy",
      "headers": {
        "request": {
          "set": {
            "Origin": ["http://<host>"]
          }
        }
      },
      "upstreams": [{ "dial": "<containerName>:<port>" }]
    }
  ],
  "terminal": true
}
```

- `@id` format: `vcloudrunner-route-<hostname>`
- `dial` uses Docker network DNS: `<container-name>:<internal-port>`
- `terminal: true` prevents further route matching
- Route upsert uses atomic read-modify-write (GET routes → filter duplicates → insert → PATCH back)

### DNS and Domains

- **Local development:** Uses `nip.io` wildcard DNS
  - Dashboard: `127.0.0.1.nip.io`
  - API: `api.127.0.0.1.nip.io`
  - Deployed apps: `<slug>.apps.127.0.0.1.nip.io`
- **Platform domain env var:** `PLATFORM_DOMAIN=apps.127.0.0.1.nip.io`

---

## Worker Docker Operations

### Container Lifecycle

1. **Pre-cleanup:** Remove any stale container with same naming convention
2. **Build image:** `docker build` from cloned repo workspace
3. **Create container:** Join `vcloudrunner-deployments` network, inject env vars, set resource limits
4. **Start container:** `docker start`
5. **Register route:** POST to Caddy admin API
6. **On failure/stop:** Remove container, remove image, clean up workspace, delete Caddy route

### Container Naming

Pattern: `vcloudrunner-<project-slug>-<deployment-id-prefix>`

Example: `vcloudrunner-venos-workshop-ad40779d`

### Resource Limits

Configurable per-deployment via project service definitions:
- `containerPort` — port the app listens on (default: 3000)
- Memory limit — default: 512 MB
- CPU limit — default: 500 millicores

### Auto-Dockerfile Generation

When a repo has no Dockerfile, the worker's `AutoDockerfileDetector` generates `Dockerfile.vcloudrunner`:
- Base: `node:20-alpine`
- Discovers subdirectories with own `package.json` and installs deps separately
- Runs `npm run build` if a build script exists
- Adds `chmod -R 777 /app` for write permissions
- Default `EXPOSE 3000`

---

## Environment Variables (Compose)

### Required (set in `.env` or host environment)

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `REDIS_PASSWORD` | Redis password |
| `ENCRYPTION_KEY` | AES-256-GCM key for env var encryption (≥32 chars) |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLATFORM_DOMAIN` | `apps.127.0.0.1.nip.io` | Base domain for deployed apps |
| `API_RATE_LIMIT_MAX` | `1000` | API rate limit per window |
| `GITHUB_APP_ID` | — | GitHub App integration |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth |

### Security Guards

- `ENABLE_DEV_AUTH: true` is **blocked** when `NODE_ENV=production` (API crashes on startup)
- `API_TOKENS_JSON` must be **empty** when `NODE_ENV=production`
- `ENCRYPTION_KEY` must be ≥32 characters

---

## Common Operations

### Rebuild a single service

```powershell
docker compose up -d --build <service>
# e.g. docker compose up -d --build worker
```

### View logs

```powershell
docker compose logs <service> --tail 50
docker compose logs <service> -f   # follow
```

### Access PostgreSQL

```powershell
docker compose exec postgres psql -U postgres -d vcloudrunner
```

### Check Caddy routes

```powershell
curl.exe -s http://localhost:2019/config/apps/http/servers/srv0/routes
```

### Restart all services

```powershell
docker compose down; docker compose up -d
```
