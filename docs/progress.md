# Vcloudrunner MVP Progress Tracker

Last updated: 2026-03-12 (Phase 3: UI/UX Polish — COMPLETE)

## Legend

- [x] Done
- [~] In progress / partial
- [ ] Not started


## Implementation Log

### Phase 1: Critical Safety (2026-03-12)

- what was built:
  - **Centralized API error handling**: extended `DomainError` with a `statusCode` property and updated `error-handler.ts` to auto-map any `DomainError` to the correct HTTP response. Removed all 16+ try/catch blocks from route handlers across 5 route files. Routes now simply throw domain errors; the plugin maps them to structured HTTP responses with appropriate status codes and request IDs. This eliminated ~200 lines of duplicated error-to-HTTP mapping code.
  - **Added `ApiTokenNotFoundError`**: new domain error (404) for token rotate/revoke not-found cases, replacing inline `notFound()` helper calls.
  - **Removed `http-errors.ts`**: the file (`unauthorized()`, `forbidden()`, `notFound()`, `conflict()` helpers) is now fully unused and should be deleted. No file imports it.
  - **Strengthened dev-admin-token bypass**: replaced `NODE_ENV === 'development'` guard with an explicit `ENABLE_DEV_AUTH` env flag (defaults to `false`). The dev bypass is now opt-in only, preventing accidental exposure in production due to missing or misconfigured NODE_ENV.
  - **Removed legacy plaintext token fallback**: the auth-context plugin no longer attempts a second DB lookup using raw plaintext token matching. All token auth now goes through SHA-256 hash lookup only.
  - **Fixed shared-types ambient declaration drift**: cleared the ambient `declare module '@vcloudrunner/shared-types'` blocks from both `apps/api/src/types/shared-types.d.ts` and `apps/worker/src/types/shared-types.d.ts`. Types now resolve exclusively from the real `packages/shared-types` package, eliminating silent drift risk between apps.
  - **Added graceful shutdown to API**: `src/index.ts` now handles SIGTERM and SIGINT signals, calling `app.close()` to drain connections and clean up resources (Redis, queue) before exit. (Worker already had graceful shutdown.)
- files created or changed:
  - `apps/api/src/server/domain-errors.ts` — added `statusCode` to `DomainError`, added `ApiTokenNotFoundError`
  - `apps/api/src/plugins/error-handler.ts` — auto-maps `DomainError` → HTTP with structured logging
  - `apps/api/src/modules/deployments/deployments.routes.ts` — removed try/catch blocks and unused imports
  - `apps/api/src/modules/projects/projects.routes.ts` — removed try/catch blocks and unused imports
  - `apps/api/src/modules/environment/environment.routes.ts` — removed try/catch blocks and unused imports
  - `apps/api/src/modules/logs/logs.routes.ts` — removed try/catch blocks and unused imports
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts` — removed try/catch blocks, uses `ApiTokenNotFoundError`
  - `apps/api/src/plugins/auth-context.ts` — `ENABLE_DEV_AUTH` flag, removed legacy plaintext fallback
  - `apps/api/src/config/env.ts` — added `ENABLE_DEV_AUTH` env variable
  - `apps/api/src/index.ts` — added graceful shutdown (SIGTERM/SIGINT)
  - `apps/api/src/types/shared-types.d.ts` — cleared ambient declarations
  - `apps/worker/src/types/shared-types.d.ts` — cleared ambient declarations
  - `docs/production-readiness-audit.md` — recreated comprehensive audit document
- what is still missing:
  - `apps/api/src/server/http-errors.ts` should be deleted (fully unused dead code)
  - Phase 2: Production Reliability (streaming log export, DB pool limits, state reconciliation, API tests)
  - Phase 3: UI/UX Polish (dashboard route extraction, shadcn/ui, status badges, toasts, loading states)
  - Phase 4: Extensibility (alert extraction, worker decomposition, event hooks, multi-user)
- known issues:
  - compose runtime cannot be executed in this environment due to missing Docker CLI
  - `ENABLE_DEV_AUTH=true` must be set explicitly in development `.env` files for the dev-admin-token to work — this is an intentional breaking change for safety
- next recommended step:
  - begin Phase 2: Production Reliability (state reconciliation, DB pool limits, streaming log export, API tests)

### Phase 1 completion: token URL fix + type cleanup (2026-03-12)

- what was built:
  - **Removed token plaintext from URL parameters** (CRITICAL security fix): `createApiTokenAction` and `rotateApiTokenAction` no longer pass the token via `?tokenPlaintext=...` in the redirect URL. Instead, the token is set as a short-lived HTTP-only cookie (`__token_plaintext`, `maxAge: 120`, `sameSite: strict`, `secure` in production). The `DashboardPage` component reads and immediately deletes the cookie on render, displaying the token in the existing amber "copy now" box. This eliminates exposure via browser history, server logs, address bar, and Referer headers.
  - **Removed `next-shims.d.ts` stub declarations**: cleared the file that declared incomplete stubs for `next/server`, `next/cache`, and `next/navigation`, which were shadowing the real Next.js types. Real types now resolve from the `next` package via `next-env.d.ts`.
  - **Confirmed `http-errors.ts` already deleted**: the dead code file was removed between sessions.
- files created or changed:
  - `apps/dashboard/app/page.tsx` — cookie-based token flash (import `cookies` from `next/headers`, set cookie in server actions, read+delete in page component), removed `tokenPlaintext` from `searchParams` interface
  - `apps/dashboard/types/next-shims.d.ts` — cleared stub declarations
  - `docs/production-readiness-audit.md` — marked Phase 1 items 5+6 complete, updated security matrix
- what is still missing:
  - Phase 1 is now COMPLETE — all 6 items done
  - Phase 2: Production Reliability is next
- known issues:
  - none
- next recommended step:
  - begin Phase 2: Production Reliability

### Phase 2: Production Reliability (2026-03-12)

- what was built:
  - **State reconciliation on worker startup**: on `ready` event, the worker queries all deployments with `status = 'running'` joined to their containers, inspects each Docker container, and marks any deployment whose container is missing or stopped as `failed` with a `STATE_RECONCILIATION` log entry. New `listRunningDeploymentContainers()` in repository, `reconcileRunningDeployments()` in service.
  - **Database pool limits and timeouts**: added configurable `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_POOL_STATEMENT_TIMEOUT_MS` to both API and Worker Zod env schemas. Applied to API's Drizzle Pool and Worker's raw pg Pool. Sensible defaults (API: 20 max, Worker: 10 max, 30s idle, 5s connect, 30s statement).
  - **Streaming log export**: replaced `gzipSync` blocking call in log export route with `createGzip()` + PassThrough stream pipeline. NDJSON lines written to PassThrough, piped through async gzip, and streamed to the response. Eliminates event loop blocking for large log exports.
  - **API integration tests**: 8 tests using Fastify's `inject()` covering all domain error → HTTP status code mappings, non-domain error → 500, and 404 not-found handler. Uses Node's built-in test runner (`node:test` + `node:assert`).
  - **Database backup documentation**: created `docs/database-backup.md` with pg_dump strategy, Docker Compose sidecar option, retention tiers (daily/weekly/monthly), restore procedure, verification steps, and encryption recommendations.
- files created or changed:
  - `apps/worker/src/index.ts` — startup reconciliation call + Docker import
  - `apps/worker/src/services/deployment-state.repository.ts` — `listRunningDeploymentContainers()`, pool config
  - `apps/worker/src/services/deployment-state.service.ts` — `reconcileRunningDeployments()`
  - `apps/worker/src/config/env.ts` — DB pool config vars
  - `apps/api/src/config/env.ts` — DB pool config vars
  - `apps/api/src/db/client.ts` — pool limits applied
  - `apps/api/src/modules/logs/logs.routes.ts` — streaming gzip export
  - `apps/api/src/server/api-routes.test.ts` — new test file (8 tests)
  - `apps/api/package.json` — added `test` script
  - `docs/database-backup.md` — new backup strategy doc
  - `docs/production-readiness-audit.md` — Phase 2 items marked complete
- what is still missing:
  - Phase 2 is now COMPLETE
  - Phase 3: UI/UX Polish is next
- known issues:
  - none
- next recommended step:
  - begin Phase 3: UI/UX Polish

### Phase 3: UI/UX Polish (2026-03-12)

- what was built:
  - **shadcn/ui component library**: installed CVA, clsx, tailwind-merge, Radix primitives, Lucide icons, tailwindcss-animate, Sonner toast library. Created Button, Badge (with success/warning/info/destructive variants), Card, Input, Label, and Toaster UI primitives under `components/ui/`. Configured CSS-variable-based dark theme in `globals.css` and `tailwind.config.ts`.
  - **Sidebar navigation**: created `components/sidebar.tsx` client component with 5 nav items (Projects, Deployments, API Tokens, Environment, Logs) using Lucide icons and `usePathname()` for active state highlighting.
  - **Route extraction from monolithic page.tsx**: decomposed the ~920-line single-page dashboard into proper Next.js route segments:
    - `/projects` — project list, create form, deploy trigger actions
    - `/deployments` — deployment table with status badges and quick links
    - `/deployments/[id]` — deployment detail with timeline, metadata, and logs
    - `/tokens` — API token CRUD (create/rotate/revoke) with cookie-based token flash
    - `/environment` — environment variable management per project
    - `/logs` — deployment log viewer with auto-refresh, live stream, and NDJSON/GZIP export
  - **Server actions per route**: extracted 7 server actions into dedicated `actions.ts` files (`projects/actions.ts`, `tokens/actions.ts`, `environment/actions.ts`) with route-scoped redirects.
  - **Shared data loader**: created `lib/loaders.ts` with `loadDashboardData()` to centralize project/deployment/health data fetching, used by multiple route pages.
  - **Shared helpers**: created `lib/helpers.ts` with `deriveDomain()`, `slugifyProjectName()`, `extractApiStatusCode()`, `createProjectErrorReason()`, and `truncateUuid()`.
  - **Root page redirect**: replaced monolithic page.tsx with a simple redirect to `/projects`.
  - **PlatformStatusStrip in layout**: created `components/platform-status.tsx` server component wrapper, rendered in `layout.tsx` above all route content with Suspense skeleton fallback.
  - **Status badges**: updated `DeploymentTable`, `ProjectCard`, `PlatformStatusStrip` to use semantic Badge variants (success/warning/destructive/secondary) mapped to deployment/platform status strings.
  - **UUID truncation**: `truncateUuid()` helper used in deployment table and detail breadcrumb. Deployment IDs link to detail pages.
  - **Loading states**: created `loading.tsx` skeleton files for all 5 routes (projects, deployments, tokens, environment, logs) with appropriately shaped pulse animations.
  - **Error boundaries**: created `error.tsx` and `global-error.tsx` with "Try again" reset buttons using Card components.
  - **Not-found page**: created `not-found.tsx` with link back to Projects.
  - **Empty states with guidance**: all route pages have Card-based empty states with contextual help text.
  - **Design tokens**: migrated all hardcoded `slate-800/900/950` colors to CSS-variable-based `border`, `background`, `muted`, `primary`, `accent` tokens for consistent theming.
- files created:
  - `apps/dashboard/lib/helpers.ts` — shared helper functions
  - `apps/dashboard/lib/loaders.ts` — centralized data loader
  - `apps/dashboard/lib/utils.ts` — `cn()` className merge utility
  - `apps/dashboard/components/ui/button.tsx` — CVA Button
  - `apps/dashboard/components/ui/badge.tsx` — CVA Badge with semantic variants
  - `apps/dashboard/components/ui/card.tsx` — Card components
  - `apps/dashboard/components/ui/input.tsx` — Input component
  - `apps/dashboard/components/ui/label.tsx` — Label component
  - `apps/dashboard/components/ui/sonner.tsx` — Toaster wrapper
  - `apps/dashboard/components/sidebar.tsx` — navigation sidebar
  - `apps/dashboard/components/platform-status.tsx` — layout-level status wrapper
  - `apps/dashboard/app/projects/page.tsx` — projects route
  - `apps/dashboard/app/projects/actions.ts` — project server actions
  - `apps/dashboard/app/projects/loading.tsx` — projects skeleton
  - `apps/dashboard/app/deployments/page.tsx` — deployments route
  - `apps/dashboard/app/deployments/loading.tsx` — deployments skeleton
  - `apps/dashboard/app/deployments/[id]/page.tsx` — deployment detail
  - `apps/dashboard/app/tokens/page.tsx` — tokens route
  - `apps/dashboard/app/tokens/actions.ts` — token server actions
  - `apps/dashboard/app/tokens/loading.tsx` — tokens skeleton
  - `apps/dashboard/app/environment/page.tsx` — environment route
  - `apps/dashboard/app/environment/actions.ts` — env var server actions
  - `apps/dashboard/app/environment/loading.tsx` — environment skeleton
  - `apps/dashboard/app/logs/page.tsx` — logs route
  - `apps/dashboard/app/logs/loading.tsx` — logs skeleton
  - `apps/dashboard/app/error.tsx` — route error boundary
  - `apps/dashboard/app/global-error.tsx` — root error boundary
  - `apps/dashboard/app/not-found.tsx` — 404 page
- files changed:
  - `apps/dashboard/app/page.tsx` — replaced with redirect to `/projects`
  - `apps/dashboard/app/layout.tsx` — added Sidebar, PlatformStatus, Toaster, Suspense
  - `apps/dashboard/app/globals.css` — CSS variable dark theme
  - `apps/dashboard/tailwind.config.ts` — CSS variable colors, animate plugin
  - `apps/dashboard/tsconfig.json` — `@/*` path alias
  - `apps/dashboard/package.json` — shadcn/ui dependencies
  - `apps/dashboard/components/deployment-table.tsx` — Badge status, UUID truncation, detail links
  - `apps/dashboard/components/project-card.tsx` — Card + Badge integration
  - `apps/dashboard/components/platform-status-strip.tsx` — Badge variants, design tokens
  - `docs/production-readiness-audit.md` — Phase 3 marked complete
  - `docs/progress.md` — Phase 3 entry
- what is still missing:
  - Phase 3 is now COMPLETE — all 10 items done
  - Phase 4: Extensibility is next
- known issues:
  - `page.tsx.bak` backup file exists and should be deleted manually
- next recommended step:
  - begin Phase 4: Extensibility

### Phase: Production hardening tranche (2026-03-12)
  - implemented API token security hardening path: `token_hash` + `token_last4`, new migration (`0002_token_hash_hardening.sql`), hash-based auth lookup, and one-way preview strategy
  - removed permissive implicit admin fallback from `requireAuthContext` so missing auth now consistently fails
  - added dashboard secret-safety UX: masked env values by default with reveal/copy controls
  - added destructive action confirmations for API token rotate/revoke and env variable delete
  - added deployment execution timeout controls in worker (`DEPLOYMENT_EXECUTION_TIMEOUT_MS`) and non-retryable timeout classification
  - enabled real lint gates across all workspaces with shared ESLint config and updated package scripts
  - added API structured error envelope improvements (`code`, `message`, `requestId`) including not-found handler and standardized route-level error responses
  - added `x-request-id` response header on API replies for request-level diagnostics
  - implemented end-to-end deployment correlation propagation (`request.id -> deployment queue payload -> worker lifecycle logs`)
  - replaced string-matching API error handling with typed domain errors across auth/project/deployment/environment/logs service and route boundaries
  - implemented deployment cancellation flow for queued/building deployments: API cancel endpoint, queued-job removal, cancellation request metadata, and cooperative worker-side stop/cleanup
  - added scheduled stuck-deployment recovery sweep to auto-fail stale `queued`/`building` deployments using configurable age thresholds
  - added operational observability endpoints and worker liveness signaling: API queue/worker health + metrics routes and worker Redis heartbeat publishing
  - hardened API ingress defaults with explicit CORS origin allowlist and global rate limiting controls
  - added operational alert hooks with webhook delivery, cooldown dedupe, and threshold checks for degraded worker heartbeat and queue backlog/failure anomalies
  - shipped Phase-3 dashboard trust UX: deployment detail diagnostics panel, platform status strip, and stronger empty/error state messaging across projects/deployments sections
  - started Phase-4 worker decomposition by extracting database state/log operations from `DeploymentStateService` into dedicated `DeploymentStateRepository`
  - implemented typed worker deployment failure taxonomy (`DeploymentFailure` + classifier) and switched retryability decisions from ad-hoc message checks to typed code/retryable semantics
  - implemented API token scopes/permissions model (scope persistence, auth-context scope resolution, route-level scope guards) with backward-compatible defaults for existing tokens
  - added worker runtime executor abstraction (`RuntimeExecutor` + docker adapter + factory) to decouple worker orchestration from a single concrete runtime implementation
- files created or changed:
  - `apps/api/src/modules/api-tokens/token-utils.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.repository.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.service.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/drizzle/0002_token_hash_hardening.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/dashboard/components/confirm-submit-button.tsx`
  - `apps/dashboard/components/masked-secret-value.tsx`
  - `apps/dashboard/app/page.tsx`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/worker/src/workers/deployment-worker.utils.ts`
  - `apps/worker/.env.example`
  - `.eslintrc.cjs`
  - `package.json`
  - `apps/api/package.json`
  - `apps/worker/package.json`
  - `apps/dashboard/package.json`
  - `packages/shared-types/package.json`
  - `apps/api/src/plugins/error-handler.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/http-errors.ts`
  - `apps/api/src/modules/auth/auth-scopes.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/deployments/deployments.repository.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/queue/deployment-queue.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/drizzle/0003_api_token_scopes.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/.env.example`
  - `apps/api/package.json`
  - `apps/api/src/types/shared-types.d.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/components/platform-status-strip.tsx`
  - `apps/dashboard/app/page.tsx`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/environment/environment.service.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/api/src/modules/logs/logs.service.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/types/shared-types.d.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/services/deployment-state.repository.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/workers/deployment-errors.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/workers/deployment-worker.utils.ts`
  - `apps/worker/src/services/runtime/runtime-executor.ts`
  - `apps/worker/src/services/runtime/docker-runtime-executor.ts`
  - `apps/worker/src/services/runtime/runtime-executor.factory.ts`
  - `apps/worker/src/workers/deployment-worker.utils.test.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `packages/shared-types/src/index.ts`
  - `README.md`
  - `docs/production-readiness-audit.md`
  - `docs/progress.md`
- what is still missing:
  - optional API hardening follow-ups: route-specific rate-limit tiers and trusted-proxy-aware client IP strategy
  - phase-4 architecture maturity follow-ups: external runtime adapters beyond docker and scope-aware UI management workflows
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - run API migration `0003_api_token_scopes.sql`, then implement scope-aware token management controls in dashboard UI

### Phase: Archive idempotency + delete-local integration slice (2026-03-12)

- what was built:
  - extended archive upload integration tests to assert post-upload idempotency via `.uploaded` markers (second sweep skips re-upload)
  - added integration test coverage for `DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD=true` to verify archive deletion and marker persistence
  - strengthened upload-sweep confidence for real operator lifecycle behavior beyond header/path validation
- files created or changed:
  - `apps/worker/src/services/deployment-state.archive-upload.integration.test.ts`
  - `docs/progress.md`
- what is still missing:
  - emulator-backed compatibility tests (MinIO/FakeGCS/Azurite) with provider-like error semantics
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add emulator-backed provider compatibility suite and document CI/dev runbook

### Phase: Archive upload integration-test slice (2026-03-12)

- what was built:
  - added worker integration-style tests for `uploadPendingArchives` using local HTTP capture servers and temp archive fixtures
  - validated end-to-end request paths/headers for S3 signed uploads, GCS static bearer uploads, and Azure SharedKey uploads
  - verified archive upload path still writes and transmits payload bytes as expected through public service flow
- files created or changed:
  - `apps/worker/src/services/deployment-state.archive-upload.integration.test.ts`
  - `docs/progress.md`
- what is still missing:
  - emulator-backed compatibility tests (MinIO/FakeGCS/Azurite) to validate against provider-like server semantics
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add emulator-backed provider compatibility tests and a local runbook for executing them in CI/dev

### Phase: Archive auth test expansion slice (2026-03-12)

- what was built:
  - expanded worker archive-auth test coverage across S3/GCS/Azure request construction paths
  - added assertions for S3 session-token signed header behavior, GCS static bearer usage, Azure SharedKey header shape, and S3 missing-credential fail-fast behavior
  - refactored tests to use typed service API (`createArchiveUploadRequest`) and direct env object mutation instead of dynamic module import hacks
- files created or changed:
  - `apps/worker/src/services/deployment-state.archive-auth.test.ts`
  - `docs/progress.md`
- what is still missing:
  - end-to-end provider compatibility tests against storage emulators (MinIO/FakeGCS/Azurite)
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add emulator-backed integration tests for signed uploads and document local runbook

### Phase: Archive signing hardening slice (2026-03-12)

- what was built:
  - fixed S3 SigV4 signing to include `x-amz-security-token` in canonical/signed headers whenever a session token is configured
  - exposed a typed `createArchiveUploadRequest` method on `DeploymentStateService` to avoid brittle private-method test access
  - removed test `@ts-expect-error`/`any` usage and expanded S3 signing test coverage to verify session-token header signing behavior
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.archive-auth.test.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
- what is still missing:
  - broader provider integration tests against emulated object storage endpoints
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider integration tests against MinIO/FakeGCS/Azurite flows to validate signed request compatibility end-to-end

### Phase: Archive provider signing slice (2026-03-12)

- what was built:
  - worker archive upload pipeline now builds provider-aware authenticated upload requests rather than generic unauthenticated PUT targets
  - added S3 SigV4 request signing for archive uploads, GCS auth support via static bearer token or service-account OAuth token exchange, and Azure Blob SharedKey signing
  - added worker config/env inputs for provider credentials and added a focused worker test covering S3-signed upload request construction
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.archive-auth.test.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `docs/progress.md`
- what is still missing:
  - broader provider integration tests against emulated object storage endpoints
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add integration coverage for provider upload modes using local storage emulators and document operator runbooks

### Phase: Token rotation + copy-once UX slice (2026-03-12)

- what was built:
  - added API token rotation endpoint (`POST /v1/users/:userId/api-tokens/:tokenId/rotate`) that revokes the active token and returns a replacement token once
  - dashboard token panel now supports rotate actions and surfaces one-time plaintext token output for both create and rotate operations
  - token lifecycle API client now includes a typed rotate helper and README endpoint docs include rotate route
- files created or changed:
  - `apps/api/src/modules/api-tokens/api-tokens.repository.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.service.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing integrations for S3/GCS/Azure
  - persistent first-class authn/authz model beyond bearer token ownership checks
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement provider-native SDK/signing integrations for S3/GCS/Azure to complete long-term archive export path

### Phase: Archive lifecycle cleanup controls slice (2026-03-11)

- what was built:
  - worker now includes scheduled cleanup sweeps for local archive artifacts and upload markers
  - added lifecycle controls for cleanup interval and max-age policies for archive files and marker files
  - cleanup only prunes uploaded archive files (`.uploaded` marker present) and stale marker artifacts by age
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing integrations for S3/GCS/Azure
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native SDK/signing integrations for S3/GCS/Azure

### Phase: Provider archive adapter slice (2026-03-11)

- what was built:
  - archive upload now supports provider-specific target URL adapters (`http`, `s3`, `gcs`, `azure`) selected via worker config
  - added provider-specific config inputs for bucket/container and key prefixes to support storage-specific object key routing
  - retained existing upload retry/backoff/timeout semantics and marker-file dedupe behavior
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing integrations and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native SDK/signing integrations for S3/GCS/Azure and archive lifecycle policy controls

### Phase: Archive upload retry/backoff slice (2026-03-11)

- what was built:
  - archive upload sweeps now retry failed uploads with exponential backoff and configurable cap
  - added upload retry controls via worker env (`DEPLOYMENT_LOG_ARCHIVE_UPLOAD_MAX_ATTEMPTS`, `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_BASE_MS`, `DEPLOYMENT_LOG_ARCHIVE_UPLOAD_BACKOFF_MAX_MS`)
  - upload failure now surfaces terminal retry-exhausted errors while preserving existing marker-file semantics
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - first-class provider integrations (S3/GCS/Azure SDK paths) and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native object storage adapters (S3/GCS/Azure) and archive lifecycle policy controls

### Phase: Archive upload backend slice (2026-03-11)

- what was built:
  - worker now supports scheduled upload sweeps for archived `.ndjson.gz` files to object-storage-compatible HTTP endpoints
  - upload pipeline includes optional bearer auth, timeout control, success marker files, and optional local file deletion after upload
  - added configurable env controls for archive upload base URL, auth token, interval, timeout, and local-delete behavior
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - first-class provider integrations (S3/GCS/Azure SDK paths), retry/backoff policy controls, and archive lifecycle governance
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add provider-native object storage adapters (S3/GCS/Azure) with retry/backoff and archive lifecycle policy controls

### Phase: Scheduled log archival sweep slice (2026-03-11)

- what was built:
  - worker now runs periodic archival sweeps for eligible completed deployments and writes compressed NDJSON archives to local storage
  - archival behavior is configurable via new worker env vars (`DEPLOYMENT_LOG_ARCHIVE_DIR`, `DEPLOYMENT_LOG_ARCHIVE_INTERVAL_MS`, `DEPLOYMENT_LOG_ARCHIVE_MIN_AGE_DAYS`)
  - archived file format aligns with export contract (`<deploymentId>.ndjson.gz`)
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/src/config/env.ts`
  - `apps/worker/.env.example`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - object-storage archival backend integration and managed retention lifecycle for archived artifacts
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add object-storage archival backend integration and scheduled export/upload jobs

### Phase: Compressed log export slice (2026-03-11)

- what was built:
  - deployment log export now supports compressed downloads (`format=ndjson.gz`) in addition to plain NDJSON
  - dashboard log export proxy now forwards format selection and preserves gzip content metadata
  - logs panel now exposes both export actions (`Export NDJSON`, `Export GZIP`) for selected deployment
- files created or changed:
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - object-storage archival backend + scheduled export workflows
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add object-storage archival backend integration and scheduled export jobs

### Phase: Deployment log export slice (2026-03-11)

- what was built:
  - API now exposes deployment log export endpoint (`GET /v1/projects/:projectId/deployments/:deploymentId/logs/export`) returning NDJSON attachments
  - dashboard now includes authenticated server-side proxy route (`/api/log-export`) for browser-safe downloads
  - logs UI now includes an Export NDJSON action for selected deployment
- files created or changed:
  - `apps/api/src/modules/logs/logs.repository.ts`
  - `apps/api/src/modules/logs/logs.service.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - optional compressed export/storage backend integration (object storage, scheduled archival jobs)
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add optional compressed/object-storage archival workflow and scheduled export jobs

### Phase: Dashboard token lifecycle UX slice (2026-03-11)

- what was built:
  - dashboard now renders an API token management panel for live mode (list/create/revoke)
  - token create form supports label, role, and optional expiration timestamp inputs
  - revoke actions are wired per-token; revoked tokens are shown as non-actionable status
  - dashboard API client now includes typed helpers for token list/create/revoke endpoints
- files created or changed:
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add archival/export path for long-term deployment log storage beyond DB retention window

### Phase: Token lifecycle endpoints slice (2026-03-11)

- what was built:
  - added authenticated API token lifecycle endpoints for user scope: list, create, and revoke
  - token create endpoint returns plaintext token once; list endpoint returns token previews to avoid full-token exposure
  - token lifecycle routes enforce existing actor ownership checks (`assertUserAccess`)
  - wired token routes into API server and updated README endpoint/auth docs
- files created or changed:
  - `apps/api/src/modules/api-tokens/api-tokens.repository.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.service.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/api/src/server/build-server.ts`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - dashboard/admin UX for token lifecycle management
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add dashboard/admin UX for token lifecycle management (create/revoke + safe copy-on-create)

### Phase: DB-backed auth token slice (2026-03-11)

- what was built:
  - API auth now resolves bearer tokens from a database-backed `api_tokens` table before checking static env tokens
  - auth token model now supports per-token role, optional expiration, and revocation timestamps
  - retained `API_TOKENS_JSON` fallback path for bootstrap/dev compatibility during transition
  - committed drizzle migration adding `api_tokens` table + indexes + user foreign-key
- files created or changed:
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/drizzle/0001_right_steve_rogers.sql`
  - `apps/api/drizzle/meta/0001_snapshot.json`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/.env.example`
  - `README.md`
  - `docs/database-schema.md`
  - `docs/progress.md`
- what is still missing:
  - long-term archival/export path for deployment logs beyond DB retention window
  - token lifecycle management endpoints/UX (create, rotate, revoke)
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add token lifecycle management endpoints and dashboard/admin UX for create/rotate/revoke

### Phase: Unified structured logging slice (2026-03-11)

- what was built:
  - aligned API and worker log envelopes to include consistent top-level keys (`timestamp`, `level`, `service`, `message`)
  - API Fastify logger now emits `message` key and service base metadata (`service: api`) with ISO timestamps
  - worker logger now honors configured log level filtering and emits service-tagged structured records
- files created or changed:
  - `apps/api/src/server/build-server.ts`
  - `apps/worker/src/logger/logger.ts`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - evolve bearer token config into DB-backed auth/session model with revocation and rotation

### Phase: Worker reliability test coverage slice (2026-03-11)

- what was built:
  - added worker unit tests for retry classification helpers (`isNonRetryableDeploymentError`, `remainingAttempts`)
  - added service-level tests for deployment-log retention behavior (`appendLog`, `markFailed`, `pruneLogsByRetentionWindow`)
  - refactored worker retry helper logic into `deployment-worker.utils.ts` for focused testability
  - made `DeploymentStateService` accept an optional queryable dependency to enable deterministic service tests without a live Postgres instance
  - added worker `npm test` script to run Node test files via `tsx --test` with local test env defaults
- files created or changed:
  - `apps/worker/src/workers/deployment-worker.utils.ts`
  - `apps/worker/src/workers/deployment-worker.utils.test.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/package.json`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - unified structured logging format across services
  - long-term archival/export path for deployment logs beyond DB retention window
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add unified structured logging format across services

### Phase: Project-create UX polish slice (2026-03-11)

- what was built:
  - dashboard project-create form now has optimistic pending state (`Creating…`) and disables submit while action is in flight
  - added inline field-level validation hints for name/slug/repository URL/default branch constraints
  - added live slug preview so users can see the derived slug before submitting
- files created or changed:
  - `apps/dashboard/components/project-create-form.tsx`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - worker unit/integration tests around retry and retention behavior
  - unified structured logging format across services
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add worker unit/integration tests around retry classification/backoff and log retention behavior

### Phase: Bounded log retention policy slice (2026-03-11)

- what was built:
  - worker now enforces per-deployment log row caps on each log write
  - worker now runs periodic retention pruning by log age window
  - retention controls are configurable via worker env (`DEPLOYMENT_LOG_RETENTION_DAYS`, `DEPLOYMENT_LOG_MAX_ROWS_PER_DEPLOYMENT`, `DEPLOYMENT_LOG_PRUNE_INTERVAL_MS`)
- files created or changed:
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/index.ts`
  - `apps/worker/.env.example`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - optimistic project-create UX pending/disabled state polish
  - worker unit/integration tests around retry and retention behavior
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add optimistic project-create UX (pending/disabled state + richer field-level validation)


### Phase: Bearer auth boundary upgrade slice (2026-03-11)

- what was built:
  - API auth now uses `Authorization: Bearer` token mapping (`API_TOKENS_JSON`) instead of trusting raw `x-user-id` headers
  - project/deployment/environment/log routes now read actor context from authenticated token claims (userId + role)
  - dashboard API client and SSE proxy now send bearer token via `API_AUTH_TOKEN`
- files created or changed:
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/api/src/config/env.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/api/.env.example`
  - `apps/dashboard/.env.example`
  - `README.md`
  - `docs/architecture.md`
  - `docs/progress.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - persistent auth model (DB-backed users/sessions/tokens + rotation/revocation)
  - bounded retention policy/archival strategy for deployment logs
  - optimistic project-create UX pending/disabled state polish
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - add bounded retention policy/archival strategy for deployment logs


### Phase: Workspace type/build blockers resolved slice (2026-03-11)

- what was built:
  - fixed BullMQ Redis connection typing by switching API/worker queue config to parsed connection options (instead of direct ioredis client instance typing conflict)
  - fixed dashboard Next build compatibility by moving config to `next.config.mjs` and aligning dashboard tsconfig for bundler resolution
  - added local ambient typing shims for unavailable external declarations (`pg`, `dockerode`, Next module surfaces used by dashboard)
  - validated workspace lint/typecheck/build now complete successfully in this environment
- files created or changed:
  - `apps/api/src/queue/redis.ts`
  - `apps/worker/src/queue/redis.ts`
  - `apps/api/src/queue/deployment-queue.ts`
  - `apps/dashboard/next.config.mjs`
  - `apps/dashboard/tsconfig.json`
  - `apps/dashboard/app/page.tsx`
  - `apps/api/src/types/external.d.ts`
  - `apps/worker/src/types/external.d.ts`
  - `apps/dashboard/types/next-shims.d.ts`
  - `.github/workflows/ci.yml`
  - `docs/progress.md`
  - `README.md`
- what is still missing:
  - real auth model (sessions/tokens/RBAC) beyond demo header boundary
  - bounded retention policy/archival strategy for deployment logs
  - optimistic project-create UX pending/disabled state polish
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - replace header-based demo auth with real session/token auth and RBAC


### Phase: CI checks pipeline baseline slice (2026-03-11)

- what was built:
  - added GitHub Actions workflow at `.github/workflows/ci.yml`
  - CI now runs install + workspace lint + workspace typecheck + workspace build on push/PR
  - surfaced current blocking issues directly in progress tracking for follow-up hardening
- files created or changed:
  - `.github/workflows/ci.yml`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
- what is still missing:
  - real auth model (sessions/tokens/RBAC) beyond demo header boundary
  - bounded retention policy/archival strategy for deployment logs
  - CI hardening follow-ups to resolve known type/build blockers
- known issues:
  - `ioredis` typing constructability mismatch currently breaks API/worker typecheck/build
  - dashboard Next runtime currently rejects `next.config.ts` in this environment, breaking dashboard build in CI
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - resolve workspace type/build blockers (ioredis typing + Next config compatibility) so CI turns fully green


### Phase: Worker failure-class retry tuning slice (2026-03-11)

- what was built:
  - worker now classifies known non-retryable deployment errors and short-circuits retries via BullMQ `UnrecoverableError`
  - retryable failures now log attempt/retries-left and only mark deployment failed after retry exhaustion
  - queue defaults tuned to 4 attempts with exponential backoff delay base of 5s
- files created or changed:
  - `apps/worker/src/workers/deployment.worker.ts`
  - `apps/api/src/queue/deployment-queue.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
- what is still missing:
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
  - bounded retention policy/archival strategy for deployment logs
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add CI checks/tests pipeline for workspace typecheck/lint/build


### Phase: Dashboard project-create UX refinement slice (2026-03-11)

- what was built:
  - project create action now classifies API failure reasons (e.g. slug conflict vs generic API failure)
  - dashboard now shows targeted create error messages instead of a single generic failure banner
  - project create form now includes inline guidance for slug derivation/uniqueness behavior
  - API project create now maps slug uniqueness conflict to explicit 409 response
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add failure-class-aware retry tuning/backoff for worker deployment jobs


### Phase: Live log streaming slice (2026-03-11)

- what was built:
  - API now exposes deployment log SSE stream endpoint at `/v1/projects/:projectId/deployments/:deploymentId/logs/stream`
  - dashboard now includes a Next route proxy for stream auth and a client EventSource panel for live deployment logs
  - logs UI keeps existing static/polling behavior and adds live status + incremental tail updates
- files created or changed:
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/dashboard/components/logs-live-stream.tsx`
  - `apps/dashboard/app/page.tsx`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `docs/deployment-flow.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
  - CI checks/tests pipeline for workspace typecheck/lint/build
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - improve dashboard project-create UX with inline validation and API error detail surfaces


### Phase: Minimal auth boundary slice (2026-03-11)

- what was built:
  - API now requires `x-user-id` header for project/deployment/env/log routes
  - project ownership checks added to block cross-project access for non-owners
  - dashboard API client now forwards demo user id as `x-user-id` for all requests
- files created or changed:
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/dashboard/lib/api.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - failure-class-aware retry tuning/backoff for worker deployment jobs
  - stronger auth model (sessions/tokens/RBAC) beyond demo header boundary
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - workspace typecheck remains partially blocked by existing dependency typing/resolution issues
- next recommended step:
  - add true live log streaming path (websocket/sse/pubsub)


### Phase: DB migration workflow slice (2026-03-11)

- what was built:
  - established committed drizzle migration history under `apps/api/drizzle/`
  - added API script `db:migrate` to apply committed SQL migrations
  - updated runbooks/docs to make migration-first schema evolution the canonical team path
- files created or changed:
  - `apps/api/drizzle/0000_legal_texas_twister.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/drizzle/meta/0000_snapshot.json`
  - `apps/api/package.json`
  - `docs/database-schema.md`
  - `docs/progress.md`
  - `README.md`
- what is still missing:
  - minimal auth boundary for project/deployment ownership
  - true live log streaming transport (websocket/pubsub/sse)
  - failure-class-aware retry tuning/backoff for worker deployment jobs
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - dashboard typecheck/build still cannot run here due unresolved local Next dependency/tooling setup
- next recommended step:
  - add minimal auth boundary for project/deployment ownership


### Phase: Worker cleanup + idempotency guard slice (2026-03-11)

- what was built:
  - worker now removes stale deployment container name collisions before starting a run
  - failed runs now attempt container/image/workspace cleanup to reduce leaked resources
  - cleanup operations are non-fatal and logged with warning context so primary failure reason is preserved
- files created or changed:
  - `apps/worker/src/services/deployment-runner.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
- what is still missing:
  - failure-class-aware retry policy tuning and backoff per error type
  - true live log streaming transport (websocket/pubsub/sse)
  - auth boundary for real multi-user dashboard usage
- known issues:
  - compose runtime cannot be executed in this environment due missing Docker CLI
  - dashboard typecheck/build still cannot run here due unresolved local Next dependency/tooling setup
- next recommended step:
  - add migration workflow (`drizzle generate` + committed SQL) for reproducible DB evolution


### Phase: Dashboard project creation vertical slice (2026-03-11)

- what was built:
  - dashboard New Project UI is now a real server-action form instead of a placeholder button
  - project creation is wired to API `POST /v1/projects` using demo user context
  - create flow includes deterministic slug generation from project name and success/error feedback banners
- files created or changed:
  - `apps/dashboard/app/page.tsx`
  - `apps/dashboard/lib/api.ts`
  - `docs/progress.md`
  - `docs/architecture.md`
  - `README.md`
  - `apps/dashboard/README.md`
- what is still missing:
  - true live log streaming transport (websocket/pubsub/sse)
  - auth boundary for real multi-user dashboard usage
  - stronger worker failure cleanup/idempotency coverage
- known issues:
  - typecheck/build cannot be fully validated in this environment due unresolved local Next/React module typing setup
  - compose runtime cannot be executed in this environment due missing Docker CLI
- next recommended step:
  - implement worker cleanup/idempotency guards for failed deployments


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
- [~] Authentication/authorization (minimal header ownership boundary done; real auth still planned)

## 4) Database & Data Model

- [x] Drizzle schema for users/projects/deployments/env/logs/containers/domains
- [x] Drizzle config and DB client
- [x] Deployment metadata stores runtime config
- [x] Migration history/versioning strategy (committed drizzle SQL + metadata)

## 5) Worker Service (Execution Plane)

- [x] BullMQ worker consumer
- [x] Deployment pipeline skeleton: clone -> docker build -> docker run
- [x] Postgres status/log/container/domain updates
- [x] Caddy route upsert integration
- [x] Runtime limits support (port, memory, CPU) and non-root container user
- [~] Robust failure handling/cleanup (container/image cleanup, retries by failure class)
- [x] Full log streaming (live tail via SSE)

## 6) Security & Reliability

- [x] Env vars encrypted at rest in API storage path
- [x] Runtime resource controls in worker container creation
- [~] Secret management hardening (envelope encryption / key rotation)
- [ ] Auditing / RBAC / authn
- [ ] Rate limits and abuse controls

## 7) Dashboard (Phase 5)

- [x] Next.js dashboard scaffold
- [x] Project list/create UI (API-backed create + list)
- [x] Deploy trigger UI (basic trigger wired to deployment API)
- [x] Environment variable editor UI (project selector + list/add/delete wired to API)
- [x] Deployment history + logs viewer UI (deployment selector + optional polling refresh)

## 8) Observability & DX

- [x] Basic structured logging in worker
- [x] API request/error handling baseline
- [x] Unified structured logging format across all services
- [ ] Metrics and tracing
- [x] CI checks/tests pipeline (workflow present; workspace lint/typecheck/build baseline passing locally)

## 9) Testing Status

- [~] Static checks attempted in current environment
- [ ] End-to-end compose validation (blocked by missing Docker CLI in this environment)
- [ ] Typecheck/test execution with installed dependencies (blocked by npm registry restrictions in this environment)

---

## Immediate Next Recommended Steps

1. Add provider-native SDK/signing integrations for S3/GCS/Azure.
