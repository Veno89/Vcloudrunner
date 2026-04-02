# Changelog

Reverse-chronological summary of all major additions and changes.

---

## 2026-04-02

### Auth/Team Basics
- Added email+password authentication (bcrypt, 12 salt rounds)
- Added `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/me/change-password` API endpoints
- Session tokens: 30-day API tokens labeled "Dashboard session"
- Redesigned sign-in page: email+password primary, API token secondary
- Added registration page at `/register`
- Added Change Password card to account settings
- Added Next.js middleware for route protection (unauthenticated → `/sign-in`)
- Added `InvalidCredentialsError` (401) and `EmailAlreadyRegisteredError` (409) domain errors
- Migration 0030: `password_hash` column on users table

### Docs Cleanup
- Rewrote `database-schema.md` to cover all 17 tables, 21 enums, relationships, and migration workflow
- Created `changelog.md` (this file)
- Removed obsolete audit docs (`code-health-audit.md`, `production-readiness-audit.md`, `ui-ux-audit.md`)
- Updated `roadmap.md` completion status

---

## 2026-04-01

### Code Health Audit — Batches A–F
- **Batch A**: Split monolithic `api.ts` (1308 lines) into 12 domain-specific API modules; deleted dead files (`.gitkeep`, `.tmp/`)
- **Batch B**: Decomposed `domains/page.tsx` (1574 → 200 lines) into 3 components + domain diagnostics helper library
- **Batch C**: Extracted ~3000 lines of pure helpers from `projects.service.ts` (3854 → 873 lines) into `project-domain-helpers.ts`
- **Batch D**: Split `projects.repository.ts` (1486 → 148 lines) into `ProjectDomainsRepository` and `ProjectMembersRepository`
- **Batch E**: Split `project-databases.service.ts` (1802 → 967 lines) into types + pure helpers modules
- **Batch F**: Collapsed 12 pass-through proxy factories and 11 wiring-only tests (23 files deleted) from worker

### Project Composition Model
- Added `PATCH /projects/:projectId` API endpoint with service removal guard
- Added project settings page with service editor (add/remove services, edit kind/exposure/runtime)
- Added `POST /projects/:projectId/deployments/all` deploy-all endpoint
- Added "Deploy All" button on project detail page (visible when >1 service)

---

## 2026-03-17

### Deployment/Auth/Config Hardening
- Hardened queued-deployment cancellation (fallback scan, stranded-record prevention)
- Hardened deployment creation follow-through (env decrypt failure → mark `failed`)
- Hardened worker state persistence (best-effort audit logging, event emission, route cleanup)
- Hardened cancellation finalization (runtime cleanup verification, `deployment.cancelled` event consistency)
- Fixed Fastify plugin scoping for auth-context and error-handler inheritance
- Strict boolean/numeric env parsing (`z.coerce.boolean()` → strict string parsing)
- Explicit dev-auth bypass boundaries (no longer grants access on malformed headers)
- `.env` loading alignment: repo-root first, app-local override, cwd-independent resolution
- Deterministic test env fixtures (no `.env` leakage into test suites)
- API startup/shutdown lifecycle hardening (telemetry cleanup, idempotent shutdown)
- Worker lifecycle hardening (idempotent ready handling, scheduler startup resilience)
- Overlap-safe polling for alert-monitor, worker background sweeps, and live-log SSE
- Timeout-bounded external calls (alert webhooks, Caddy admin, GCS token exchange — 10s)
- Normalized timeout/network failure messages across all outbound HTTP paths
- Per-item continuation across worker reconciliation/archive/cleanup sweeps
- Fixed route-level authorization (scope enforcement, membership-based access)
- Added comprehensive auth route test coverage (all API surfaces)
- Alert-monitor idempotent lifecycle, per-signal continuation, webhook cooldown
- Rate limiting: CORS 403, trusted-proxy support, preserved `429` status codes
- Dashboard resilience: partial-outage-aware loaders for projects, deployments, envs, tokens, logs
- Bounded dashboard server-side fetches with 10s timeouts
- Overlap-safe client-side polling, visibility-aware auto-refresh and live log streaming
- Cancellation UX: explicit `cancelling` badge across all deployment surfaces
- Redis queue URL strict parsing (integer database indexes only)

---

## 2026-03-14

### UI/UX Implementation Tranche
- Route architecture overhaul: project-scoped routes (`/projects/[id]/deployments`, `/domains`, `/databases`, `/members`, `/settings`)
- Component extraction: `ProjectSubnav`, `DeploymentStatusBadge`, `DeployLogViewer`, `FormSubmitButton`, `ConfirmSubmitButton`, `EmptyState`, `LiveDataUnavailableState`
- shadcn/ui adoption: Card, Button, Badge, Dialog, Input, Label, Select, Tabs, Tooltip
- Project domain management page with verification, TLS status, certificate chain, domain events
- Project members page with role management and invitation lifecycle
- Project databases page with health, backup, restore, service links, credentials, events
- Account settings page (profile and API tokens)
- Platform status page with deployment metrics, queue health trending, worker status
- Action feedback via `sonner` toasts with `showActionResult()` helper
- Deployment detail page with full lifecycle display
- Global deployments page with status/project filters
- Global environment shortcut page

---

## 2026-03-12

### Production Hardening Tranche
- Deployment concurrency invariant (single active deployment per project+service)
- Workspace/image/container cleanup after deployment failures
- Deployment state reconciliation sweep (stale `building`/`queued` recovery)
- Container health checks and runtime inspection
- Caddy reverse-proxy route management (add/remove on deploy/stop)
- Deployment lifecycle webhook delivery
- Operational alert monitor (queue depth, worker heartbeat, webhook cooldown)
- API health/metrics endpoints (`/health`, `/health/queue`, `/health/worker`, `/metrics/*`)

### Archive & Logging
- Deployment log archive builder (gzip-ndjson)
- Archive upload backend with provider abstraction (local, GCS, S3, Azure)
- Archive upload retry/backoff with configurable attempts
- Archive provider signing (pre-signed URLs)
- Archive lifecycle cleanup controls (retention, local delete after upload)
- Scheduled log archival sweep
- Compressed log export and download endpoints

### Token & Auth
- DB-backed API tokens with SHA-256 hash lookup, scopes, revocation, expiry
- Token lifecycle endpoints (create, list, rotate, revoke)
- Dashboard token management UX (copy-once reveal, rotate, revoke)
- Bearer auth boundary with scope enforcement

---

## 2026-03-11

### Foundation Slices
- DB migration workflow (Drizzle ORM, committed SQL migrations)
- Worker cleanup + idempotency guards
- Live log streaming (SSE endpoint, dashboard EventSource client)
- Structured logging (pino, request-id propagation)
- Bounded log retention policy
- Worker failure-class retry tuning
- CI checks pipeline baseline (typecheck, lint, test)
- Workspace type/build blockers resolved

### Dashboard Vertical Slices
- Deploy trigger page
- Environment variable editor
- Logs viewer with polling + deployment selector
- Environment project selector
- Project creation form

---

## 2026-03-08

### Initial Dashboard
- Dashboard deploy trigger vertical slice
- Dashboard env editor vertical slice
- Dashboard logs viewer vertical slice
- Dashboard logs polling + selector vertical slice
- Dashboard env project selector vertical slice
