# PR: Harden deployment cancellation races and align auth/compose guidance

## Motivation

Deployment cancellation needed one more hardening pass around queue races and partial failures, the operator docs still mixed direct workspace `.env` setup with the production-like compose path, and the API auth plugin registration left token-based auth scoped too narrowly to reliably reach sibling route plugins. This PR keeps API/domain behavior stable while tightening cancellation resilience, restoring root-level auth/error plugin behavior, and bringing the README/progress notes back in sync with the current auth and compose defaults.

## Exact Changes

- fall back to queued-job scanning when BullMQ direct `getJob(deploymentId)` lookup fails during cancellation
- continue fallback queued-job scanning when individual remove calls race, returning `completed` if any compatible queued entry is still removable
- keep queued cancellation cleanup scanning after direct `jobId` removal succeeds so legacy duplicate entries are removed when possible without downgrading a successful immediate cancel
- keep cancellation responses stable when the state change succeeds but the follow-up deployment log insert fails
- register the auth-context and error-handler plugins at the root Fastify scope so sibling route plugins inherit auth resolution and domain error mapping consistently
- add direct API unit coverage for static-token fallback auth, DB-token precedence, explicit dev-auth-only bypass behavior, and non-`/v1` `requireAuthContext` fallback behavior
- harden bootstrap `API_TOKENS_JSON` parsing so malformed JSON and duplicate token entries fail startup explicitly instead of surfacing raw parser output or silently shadowing one another
- stop invalid or malformed `Authorization` headers from silently falling back to the local dev-auth admin bypass; that bypass now applies only when credentials are absent
- add regression coverage proving root-registered auth and error plugins still apply when protected routes are registered through sibling route plugins
- add focused authorization-helper coverage for scope enforcement, user access checks, project-owner/admin bypass paths, membership-based access, and project-not-found handling
- fix `GET /projects/:projectId` so project members inherit the same membership-aware access policy as other project-scoped routes, with route tests covering member and non-member cases
- make `GET /users/:userId/projects` return membership-accessible projects as well as owned projects, with route coverage for member-visible project listing
- scope deployment-queue construction to the Fastify deployments plugin lifecycle and close it on app shutdown instead of leaking BullMQ handles from module import time
- add deployments-route regression coverage proving project members can list/create deployments with the right scopes, while outsider access and missing cancel scope are still rejected
- complete the deployments-route auth matrix with direct coverage for missing read/write scopes, outsider denial on create/cancel, and the successful member cancel contract
- add environment/logs route regression coverage proving project members can read or mutate those project-scoped resources only with the correct scopes, while outsider access is still denied
- complete the environment route auth matrix with direct coverage for read-scope rejection, write-scope rejection on upsert, outsider denial on upsert/delete, and the successful member delete contract
- extend logs-route regression coverage to prove the SSE stream endpoint enforces the same `logs:read` scope and membership checks as the list/export paths
- add api-token route regression coverage for admin cross-user list/create/revoke access, non-admin user-boundary rejection, missing write scope, and token rotate/revoke not-found mappings
- complete the api-token route auth matrix with direct coverage for list read-scope rejection, successful admin rotate, cross-user rotate/revoke denial, and missing write-scope rejection on rotate/revoke
- add alert-monitor service coverage for worker-heartbeat unavailable/stale handling, queue-metric shaping, webhook cooldown behavior, and operational threshold alert fan-out
- make alert-monitor startup idempotent so repeated `start()` calls do not stack duplicate polling intervals, with direct tests for start/stop lifecycle behavior and warning-path logging on initial/interval failures
- add build-server operational endpoint coverage for `/health`, `/health/queue`, and `/health/worker`, plus clean shutdown assertions for the alert monitor, queue client, and redis client via an injected test seam
- extend `buildServer()` coverage so thrown worker-health checks map to explicit `503 unavailable` payloads and shutdown still completes cleanly when queue or Redis close hooks fail
- harden `/metrics/queue` and `/metrics/worker` so async metric collection failures return explicit `503 unavailable` payloads instead of bubbling as generic `500` responses, with direct regression coverage for raw metrics passthrough and degraded/failure semantics
- fix `buildServer()` route registration scope so global rate limiting actually attaches to the health endpoints and sibling `/v1` route plugins instead of silently missing those routes
- make disallowed CORS origins return an explicit `403` operational rejection instead of surfacing as a generic `500`
- add explicit `TRUST_PROXY` support in API env/config and enable it in compose so proxy-forwarded client IPs can drive rate-limit allowlists behind Caddy/cloudflared
- preserve explicit operational status codes from non-domain Fastify/plugin errors in the shared error handler so rate-limit rejections stay `429` instead of being flattened into `500`
- add ingress regression coverage for allowlisted and blocked CORS origin handling, trusted-proxy-aware forwarded IP rate-limit behavior, global rate-limit headers/throttling, and shared error-handler preservation of plugin-provided `429` responses
- complete the projects-route auth matrix with direct coverage for admin cross-user create/list access, user-boundary rejection on create/list, missing `projects:write` enforcement on create, and missing `projects:read` enforcement on list/get
- harden live log SSE polling so transient backend read failures emit one final stream error event and close cleanly instead of leaving an unhandled async failure loop
- add API unit coverage for queue lookup failure fallback and cancellation log partial-failure behavior
- align dashboard deployment filtering/status badges with the backend `stopped` status while preserving backward compatibility for legacy `status=cancelled` URLs
- align remaining dashboard deployment surfaces to the shared deployment status enum and show explicit stopped/cancelled guidance on deployment detail pages
- make dashboard demo-mode fallback messages surface actionable auth/config hints instead of only generic API-unavailable copy
- remove the misleading `API_AUTH_TOKEN=dev-admin-token` default from the dashboard example env and clarify that explicit dev-auth bypass remains local-only opt-in
- make project-scoped dashboard pages degrade into explicit live-data unavailable states instead of failing hard on token/auth/config problems
- harden dashboard live log proxy routes so missing tokens, rejected tokens, upstream outages, and empty upstream bodies return explicit actionable failures instead of generic proxy errors
- stop compose from injecting a fake `NEXT_PUBLIC_DEMO_USER_ID` and align dashboard docs so missing demo-user configuration intentionally degrades to explicit guidance
- make dashboard token management surface auth/config failures as explicit unavailable states and map token create/rotate/revoke failures to actionable auth/scope/not-found messages
- make the global environment and logs shortcuts distinguish true empty data from auth/config/API outages instead of showing misleading empty-state titles
- make global and project-scoped environment variable actions preserve user context on invalid input and surface actionable auth/scope/not-found failure messages
- make project creation fail explicitly when demo-user context is missing and map project create/deploy auth or access errors to actionable dashboard messages
- make top-level demo-mode banners say live project/deployment data is unavailable instead of incorrectly implying the API itself is always down
- keep redeploy failures on the current project/deployment page by threading a safe return path through deployment actions and rendering local action toasts on those detail views
- keep project/deployment detail pages usable when log reads fail by degrading only the log panels and showing explicit inline live-data guidance
- apply the same partial log-read degradation to the global and project-scoped logs pages so selectors and export controls remain usable during log-history outages
- keep dashboard platform health visible even when `NEXT_PUBLIC_DEMO_USER_ID` is unset by decoupling queue/worker health reads from project-scoped live-data requirements
- keep the status page honest under partial outages by showing live platform health while marking deployment-history metrics as unavailable instead of implying there is simply no deployment history
- make dashboard platform-health loading resilient per endpoint and back the `API` badge with the real `/health` endpoint instead of inferring it from queue/worker responses
- preserve worker `stale` health semantics in the dashboard client even though the API returns that operational warning via HTTP 503
- clarify compose quick start requirements for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ENCRYPTION_KEY`, optional dashboard auth variables, and the separation from app-local `.env` files
- align the production-readiness audit wording with the current compose/auth defaults so it no longer describes compose as enabling dev auth by default
- recalibrate the top-level phase snapshot in `docs/progress.md` so the reported phase-left percentages reflect the work already landed during this hardening pass
- recalibrate the top-level phase snapshot again now that the auth and dashboard hardening coverage has moved the phases forward materially
- bump the Phase 2 snapshot again to reflect the new operational health/alert-monitor validation coverage
- bump the Phase 2 snapshot again to reflect the new alert-monitor lifecycle hardening and validation coverage
- bump the Phase 2 snapshot again to reflect the new operational endpoint and shutdown lifecycle validation coverage
- bump the Phase 2 snapshot again to reflect the new server-metrics endpoint validation and failure-mapping hardening
- bump the Phase 2 snapshot again to reflect the fuller logs-route auth matrix, including the live stream endpoint
- bump the Phase 2 snapshot again to reflect the completed deployments-route auth matrix across list/create/cancel
- bump the Phase 2 snapshot again to reflect the completed api-token route auth matrix across list/rotate/revoke
- bump the Phase 2 snapshot again to reflect the completed environment route auth matrix across list/upsert/delete
- bump the Phase 2 snapshot again to reflect the completed top-level projects auth matrix across create/list/get
- bump the Phase 2 snapshot again to reflect fuller worker-health error mapping and shutdown-resilience validation in `buildServer()`
- bump the Phase 2 snapshot again to reflect ingress-contract hardening around CORS, rate limiting, and shared plugin error handling
- bump the Phase 2 snapshot again to reflect explicit denied-origin CORS handling in the ingress contract
- bump the Phase 2 snapshot again to reflect trusted-proxy-aware ingress handling for forwarded client IPs behind Caddy/cloudflared
- bump the Phase 1 snapshot again to reflect stricter bootstrap token startup validation on the remaining auth fallback path
- bump the Phase 1 snapshot again to reflect explicit rejection of invalid credentials during dev-auth fallback flows
- align README auth wording with the current membership-aware project access model
- document the current cancellation semantics and refresh progress wording so `ENABLE_DEV_AUTH`, `API_TOKENS_JSON`, and `stopped` status references match the implementation
- make `apps/api/.env.example` explicitly show `ENABLE_DEV_AUTH=false` alongside the bootstrap token fallback example

## Tests Run

- `npm --workspace @vcloudrunner/api test`
  - passed (`144/144`)
- `npm run typecheck`
  - passed
