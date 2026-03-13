# Vcloudrunner — Production-Readiness Audit

Date: 2026-03-12  
Auditor: Principal Platform Architect (AI)  
Scope: Full codebase — API, Worker, Dashboard, Shared Packages, Infrastructure  
Stage Assessment: **Late MVP / Early Pre-Production**

---

## 1. Executive Summary

Vcloudrunner has proven its core thesis: it successfully deployed and ran the Vvoice backend, demonstrating a working deploy → build → run → route pipeline. The queue-driven architecture (Fastify API → BullMQ → Worker → Docker → Caddy) is fundamentally sound and well-chosen for a single-node self-hosted PaaS.

However, several critical issues prevent calling it production-ready:

| Area | Maturity | Key Blocker |
|------|----------|-------------|
| Deployment Pipeline | ★★★★☆ | Proven with real workload; needs edge-case hardening |
| API Backend | ★★★☆☆ | Works but massive error-handling duplication, no graceful shutdown |
| Worker Backend | ★★★☆☆ | Functional but God-service, raw SQL alongside ORM |
| Dashboard | ★★☆☆☆ | Single 600-line page; token in URL; no loading states; raw JS handlers |
| Security | ★★½☆☆ | Good token hashing, but dev-bypass and plaintext URL exposure |
| Observability | ★★½☆☆ | Correlation IDs exist; structured logging incomplete |
| Infrastructure | ★★★☆☆ | Docker Compose works; default credentials; single-node only |

**Bottom line:** The backend pipeline is ahead of the frontend. The dashboard is the single biggest drag on production readiness and user trust.

---

## 2. What Is Already Working Well

### 2.1 Proven Deployment Pipeline
The 14-step deployment flow (create → queue → clone → build → run → route → serve) works end-to-end. Real-world validation with Vvoice proves this isn't scaffolding.

### 2.2 Typed Domain Errors
`DomainError` subclasses (`ProjectNotFoundError`, `DeploymentAlreadyActiveError`, etc.) give structured, meaningful errors throughout the backend.

### 2.3 API Token Security Model
- SHA-256 hashing with per-token salts (never stores plaintext)
- AES-256-GCM encryption for environment variables
- Scoped tokens (`deployment:trigger`, `deployment:read`, `project:read`, etc.)
- Show-once plaintext pattern on creation

### 2.4 Deployment Lifecycle Management
- Container health checks with configurable timeout/retries
- Stuck deployment recovery (worker heartbeat + sweeper)
- Build log capture and archival (S3/GCS/Azure/local)
- Automatic cleanup of old containers on redeploy
- Configurable deployment timeout and retention

### 2.5 Configuration Validation
Both API and Worker use Zod schemas for environment validation — the app fails fast on misconfiguration.

### 2.6 Correlation IDs
Request-scoped `x-request-id` headers flow through API to queue to worker, enabling distributed tracing.

### 2.7 Runtime Safety
- `allowedBaseImages` whitelist for Docker builds
- Network mode configuration for container isolation
- Resource limits passed through to Docker container creation
- Container stop timeout before force kill

### 2.8 Log Archival Pipeline
Multi-provider archive support (S3, GCS, Azure Blob, local filesystem) with signed URL generation for log retrieval.

---

## 3. Critical Risks

### 3.1 ~~CRITICAL — Token Plaintext Exposed in URL Parameters~~ (FIXED)
**File:** `apps/dashboard/app/page.tsx`  
**Issue:** ~~After API token creation, the plaintext token is passed via `?tokenPlaintext=...` in the URL.~~  
**Status:** ✅ Fixed — Token now transmitted via short-lived HTTP-only cookie with `sameSite: strict`. Cookie is read once and immediately deleted on render.

### 3.2 CRITICAL — Dashboard Is a Single 600-Line Page
**File:** `apps/dashboard/app/page.tsx`  
**Issue:** The entire dashboard UI lives in one page component with 8 server actions, all data fetching, all rendering, and tab-based "navigation" via URL search params. This makes the dashboard:
- Impossible to deep-link to specific resources
- Unmaintainable as features grow
- Unable to show proper loading/error states per section
- A poor foundation for any future UI work

**Fix:** Extract into proper Next.js route segments (`/projects`, `/projects/[id]`, `/projects/[id]/deployments/[deploymentId]`, `/settings/tokens`).

### 3.3 HIGH — Route Error Handling Duplication
**Files:** All files in `apps/api/src/modules/*/routes.ts`  
**Issue:** Every single route handler (16+) contains identical try/catch blocks mapping `DomainError` subclasses to HTTP status codes. This is ~200 lines of pure duplication.

**Fix:** Extend `error-handler.ts` plugin to map `DomainError` → HTTP responses automatically. Routes should just throw; the plugin catches.

### 3.4 HIGH — Dev Admin Token Bypass
**File:** `apps/api/src/plugins/auth-context.ts`  
**Issue:** The `dev-admin-token` bypass is gated only by `NODE_ENV === 'development'`. If NODE_ENV is accidentally unset or misconfigured in production, this could be exposed. Additionally, there's a legacy plaintext token fallback path.

**Fix:** Use a dedicated `ENABLE_DEV_AUTH` flag that defaults to `false`. Remove the legacy plaintext fallback.

### 3.5 HIGH — Shared Types Ambient Declaration Drift
**Files:** `apps/api/src/types/shared-types.d.ts`, `apps/worker/src/types/shared-types.d.ts`  
**Issue:** Both apps contain ambient `.d.ts` files that shadow the real `packages/shared-types` package. Types can silently diverge between the apps and the shared package.

**Fix:** Delete the ambient files. Import from `@vcloudrunner/shared-types` directly.

---

## 4. Architecture Audit

### 4.1 API (`apps/api`)

**build-server.ts is overloaded (~270 lines)**  
Mixes Fastify server construction, CORS, rate limiting, Swagger, auth plugin, error handler, route registration, alert monitoring system (checks queue depth, worker heartbeat, failed jobs), health endpoints, queue metrics endpoints, and gzip compression — all in one function.

**Service instantiation is scattered**  
Some services are created inside `buildServer()`, some in route files. No dependency injection container.

**No graceful shutdown**  
`src/index.ts` calls `server.listen()` but has no SIGTERM/SIGINT handler to drain connections and close pools.

**`gzipSync` blocking call**  
Log export uses synchronous gzip in an async handler, blocking the event loop for large logs.

**Memory-loaded log export**  
`GET /logs/:id/export` loads entire log content into memory before gzipping and sending. No streaming.

### 4.2 Worker (`apps/worker`)

**God-service: `deployment-state.service.ts` (~500 lines)**  
Handles state transitions, log archival, S3/GCS/Azure upload, signed URL generation, retry logic, and cleanup. Too many responsibilities.

**Raw SQL alongside Drizzle ORM**  
`deployment-state.repository.ts` uses raw `pg` Pool queries with hand-written SQL while the API uses Drizzle. Two different data access patterns for the same database.

**Manual transaction management**  
Worker manages transactions manually instead of using a transaction helper.

**Docker CLI shelling**  
Some Docker operations use `execSync` to shell out to Docker CLI instead of going through Dockerode consistently.

### 4.3 Dashboard (`apps/dashboard`)

**Raw JS event handlers**  
`onchange="this.form.submit()"` raw JavaScript strings instead of React event handlers.

**No loading states**  
Server actions execute with no user feedback. No pending/loading indicators.

**`next-shims.d.ts` overrides real types**  
Declares stub types for `next/font/google`, `next/navigation`, etc. that override real Next.js types, suppressing legitimate type errors.

**No navigation architecture**  
Everything is URL param tabs (`?tab=deployments`). No route hierarchy, no breadcrumbs, no deep linking to specific deployments or projects.

**Inline server actions**  
8 server actions defined directly in the page component.

**Raw UUIDs displayed to users**  
Full UUIDs shown in deployment tables and project views.

### 4.4 Infrastructure

**Default credentials in docker-compose**  
`POSTGRES_PASSWORD: postgres`, `REDIS_PASSWORD` not set.

**`NEXT_PUBLIC_API_BASE_URL` may be unreachable**  
Set to `http://api:3001` pointing to Docker internal network, but as a `NEXT_PUBLIC_` variable it's used client-side where `api:3001` is not resolvable.

---

## 5. Production Readiness Matrix

### Error Handling
| Item | Status | Notes |
|------|--------|-------|
| Domain errors defined | ✅ | Good `DomainError` hierarchy |
| Domain errors mapped to HTTP | ✅ | Centralized in error-handler plugin via `DomainError.statusCode` |
| Unhandled promise rejections | ⚠️ | Global handler exists but no structured logging |
| Worker job failure taxonomy | ✅ | `BUILD_FAILED`, `START_FAILED`, `TIMEOUT`, etc. |
| Dashboard error states | ❌ | No error boundaries, no per-action error display |

### Resilience & Recovery
| Item | Status | Notes |
|------|--------|-------|
| Stuck deployment recovery | ✅ | Heartbeat sweeper with configurable interval |
| Container cleanup on failure | ✅ | Cleanup runs in `finally` blocks |
| Queue retry with backoff | ✅ | Exponential backoff configured |
| Database connection pooling | ✅ | Configurable pool max, idle timeout, connection timeout, statement timeout |
| Graceful shutdown | ✅ | Both API and worker handle SIGTERM/SIGINT with resource cleanup |

### Observability
| Item | Status | Notes |
|------|--------|-------|
| Correlation IDs | ✅ | `x-request-id` propagated |
| Structured logging | ⚠️ | Pino used but inconsistent structured fields |
| Health endpoints | ✅ | `/health`, `/health/detailed` |
| Queue metrics | ✅ | `/metrics/queue` endpoint |
| Alert monitoring | ✅ | Queue depth, worker heartbeat, failed job checks |
| Deployment state tracking | ✅ | Full lifecycle status updates in DB |

### Security
| Item | Status | Notes |
|------|--------|-------|
| Token hashing | ✅ | SHA-256 with per-token salt |
| Env var encryption | ✅ | AES-256-GCM |
| Token scopes | ✅ | Granular permission model |
| Dev auth bypass | ✅ | Gated by explicit `ENABLE_DEV_AUTH` flag (default false) |
| Token in URL params | ✅ | Fixed — token passed via HTTP-only cookie flash |
| CORS configuration | ✅ | Configurable origins |
| Rate limiting | ✅ | Global rate limit configured |
| Image whitelist | ✅ | `allowedBaseImages` |

### Data Integrity
| Item | Status | Notes |
|------|--------|-------|
| Schema migrations | ✅ | Drizzle Kit with versioned migrations |
| Foreign key constraints | ✅ | Proper relationships defined |
| Cascade deletes | ✅ | Configured appropriately |
| Unique constraints | ✅ | On project slugs, token hashes |
| Database backups | ✅ | Strategy documented in `docs/database-backup.md` |

---

## 6. UI/UX Audit

### 6.1 Information Architecture
**Current:** Single page with tab navigation (`projects` | `deployments` | `tokens`)  
**Problem:** No hierarchy. Cannot deep-link. Cannot share URLs to specific resources. No breadcrumbs. Mental model is flat when the domain is hierarchical (Platform → Projects → Deployments → Logs).

### 6.2 Interaction Patterns
- **Form submission:** Raw HTML form submits with `onchange="this.form.submit()"` — bypasses React, no optimistic UI
- **Destructive actions:** `ConfirmSubmitButton` exists but inconsistently applied
- **Token creation:** Shows plaintext once but token is also in URL params
- **Deployment trigger:** No progress indication after triggering
- **Log viewing:** Auto-refresh and live-stream components exist but UX is basic

### 6.3 Status Communication
- **Deployment status:** Text-only status values shown in tables, no color-coded badges
- **Platform health:** `PlatformStatusStrip` shows API/queue/worker health — good foundation
- **Build progress:** No real-time build step visibility
- **Error feedback:** No toast/notification system; errors only surface on page reload

### 6.4 State Gaps
| State | Implemented? | Notes |
|-------|-------------|-------|
| Loading | ❌ | No spinners, skeletons, or pending indicators |
| Empty | ⚠️ | Basic "no projects" but no guidance or CTAs |
| Error | ❌ | No error boundaries, no per-action error display |
| Success | ❌ | No confirmation feedback for actions |
| Partial failure | ❌ | No handling of partial data load failures |

### 6.5 Accessibility
- No ARIA labels on interactive elements
- No keyboard navigation patterns
- No focus management after actions
- Color contrast unchecked
- No responsive breakpoints verified

### 6.6 Top 10 UI/UX Priorities
1. **Extract dashboard into proper routes** with project → deployment hierarchy
2. **Remove token from URL params** — use session flash or similar
3. **Add status badges** with color coding for deployment states
4. **Add toast/notification system** for action feedback
5. **Add loading states** (spinners, skeleton screens) for all async operations
6. **Replace raw JS handlers** with React event handlers
7. **Add empty states** with guidance CTAs
8. **Truncate UUIDs** in display (show first 8 chars with copy-on-click)
9. **Add responsive layout** breakpoints
10. **Add error boundaries** per route segment

---

## 7. Scalability & Growth Audit

### Future-Friendly
- Queue-based architecture naturally decouples API from Worker
- Multi-provider archive support (S3/GCS/Azure/local) ready for cloud migration
- Runtime executor abstraction allows future non-Docker runtimes
- Token scopes enable future fine-grained access control

### Growth Bottleneck Risks
- **Single-node:** No horizontal scaling path for workers yet
- **No multi-user:** Single-tenant only, no user/org model
- **No network isolation:** Deployed containers share Docker bridge
- **Caddy routes accumulate:** No route pruning for deleted projects
- **Docker images accumulate:** No image garbage collection
- **Log storage unbounded:** Retention configured but local storage grows

---

## 8. Codebase Hygiene

### Duplication Inventory
| What | Where | Impact |
|------|-------|--------|
| Error-to-HTTP mapping | All 16 route handlers | ~200 lines duplicated |
| Redis connection parser | `apps/api/src/queue/redis.ts` + `apps/worker/src/queue/redis.ts` | Identical functions |
| Shared types ambient | `apps/api/src/types/shared-types.d.ts` + `apps/worker/src/types/shared-types.d.ts` | Shadow real package |

### Dead Code / Stale Files
- `apps/dashboard/lib/mock-data.ts` — mock data file, unclear if still used
- ~~`apps/dashboard/types/next-shims.d.ts`~~ ✅ Cleared — stubs removed
- ~~`apps/api/src/server/http-errors.ts`~~ ✅ Deleted — dead code after error-handler refactor

### File Size Concerns
| File | Lines | Issue |
|------|-------|-------|
| `apps/dashboard/app/page.tsx` | ~600 | Entire dashboard in one file |
| `apps/worker/src/services/deployment-state.service.ts` | ~500 | God-service |
| `apps/api/src/server/build-server.ts` | ~270 | Server setup + monitoring + metrics |

### Test Coverage Gaps
- API: No tests found
- Worker: Some unit tests for deployment state and archive auth
- Dashboard: No tests found

---

## 9. Prioritized Improvement Plan

### Phase 1: Critical Safety (Immediate)
1. ~~**Centralize API error handling**~~ ✅ — `DomainError` now carries `statusCode`; `error-handler.ts` auto-maps all domain errors to HTTP; ~200 lines of try/catch duplication removed from all 5 route files
2. ~~**Strengthen dev-admin-token**~~ ✅ — Added `ENABLE_DEV_AUTH` flag (default false); removed legacy plaintext token fallback
3. ~~**Fix shared types**~~ ✅ — Cleared ambient `.d.ts` declarations; types resolve from real `@vcloudrunner/shared-types` package
4. ~~**Add graceful shutdown**~~ ✅ — SIGTERM/SIGINT handler added to API `index.ts` (worker already had one)
5. ~~**Remove token from URL**~~ ✅ — Token plaintext now passed via short-lived HTTP-only cookie (`__token_plaintext`); URL params only carry success/label metadata
6. ~~**Remove `next-shims.d.ts`**~~ ✅ — Stub declarations removed; real types from `next` package now resolve correctly

### Phase 2: Production Reliability
1. ~~**State reconciliation**~~ ✅ — Worker reconciles DB `running` deployments against actual Docker container state on startup; marks orphaned deployments as failed
2. ~~**Database pool limits**~~ ✅ — Configurable `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_POOL_STATEMENT_TIMEOUT_MS` for both API (Drizzle/pg) and Worker (raw pg)
3. Configuration assertions (fail-fast for missing critical env vars — already done via Zod schemas)
4. ~~**Streaming log export**~~ ✅ — Replaced `gzipSync` blocking call with `createGzip()` stream pipeline; response streams NDJSON through async gzip
5. ~~**API integration tests**~~ ✅ — 8 tests covering error handler mapping (all DomainError → HTTP status codes, non-domain → 500, 404 handler) using Fastify `inject()`
6. ~~**Database backup documentation**~~ ✅ — `docs/database-backup.md` with pg_dump strategy, Docker sidecar option, retention tiers, restore procedure, and verification steps

### Phase 3: UI/UX Polish
1. ~~Extract dashboard into proper Next.js routes with hierarchy~~ ✅ DONE
2. ~~Add shadcn/ui component library~~ ✅ DONE
3. ~~Status badges with semantic colors~~ ✅ DONE
4. ~~Toast/notification system for action feedback~~ ✅ DONE (Sonner)
5. ~~Loading states (spinners, skeletons)~~ ✅ DONE
6. ~~Replace raw JS event handlers with React patterns~~ ✅ DONE (route extraction removed them)
7. ~~UUID truncation with copy-on-click~~ ✅ DONE
8. ~~Empty states with guidance~~ ✅ DONE
9. ~~Error boundaries per route~~ ✅ DONE
10. ~~Navigation with breadcrumbs~~ ✅ DONE (sidebar nav + deployment detail breadcrumb)

### Phase 4: Extensibility
1. ~~Extract alert monitoring from `build-server.ts` into dedicated module~~ ✅ DONE
2. ~~Decompose worker God-service into focused services~~ ✅ DONE
3. ~~Event hooks / webhook system for deployment lifecycle~~ ✅ DONE
4. ~~Build system detection (auto-detect Dockerfile, package.json, etc.)~~ ✅ DONE
5. ~~Multi-user groundwork (user model, ownership)~~ ✅ DONE
6. ~~Network isolation for deployed containers~~ ✅ DONE
7. ~~OpenTelemetry integration~~ ✅ DONE
8. ~~Token scope management UI~~ ✅ DONE

---

## 10. Quick Wins (High ROI, Low Effort)

1. ~~Centralize error handler~~ ✅ DONE
2. ~~Add `ENABLE_DEV_AUTH` env flag~~ ✅ DONE
3. ~~Clear ambient shared-types `.d.ts` files~~ ✅ DONE
4. ~~Add SIGTERM handler to API `index.ts`~~ ✅ DONE
5. ~~Truncate UUIDs in dashboard display~~ ✅ DONE
6. ~~Add color-coded status badges (CSS-only change)~~ ✅ DONE
7. ~~Replace `onchange="this.form.submit()"` with React handlers~~ ✅ DONE
8. ✅→⬜ Add `rel="noopener noreferrer"` to external links
9. ~~Configure DB pool limits in Drizzle client~~ ✅ DONE
10. ~~Document backup strategy~~ ✅ DONE

---

## 11. Long-Term Watchouts

1. **Encryption key rotation** — No mechanism to rotate AES keys for env vars
2. **Log storage scaling** — Local log storage will grow unbounded even with retention
3. **Docker image garbage collection** — No cleanup of old build images
4. **Secrets in queue payloads** — Env vars pass through Redis in queue job data
5. **Caddy route accumulation** — Routes added but never pruned for deleted deployments
6. **Single-point-of-failure Redis** — Queue + cache + pub/sub all on one Redis
7. **No rate limiting per token** — Global rate limit only, no per-API-token limits
8. **Migration rollback** — No down migrations defined
9. **Container log rotation** — Docker container logs can fill disk
10. **Build cache invalidation** — No strategy for Docker build cache management
