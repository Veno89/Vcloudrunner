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
- add regression coverage proving root-registered auth and error plugins still apply when protected routes are registered through sibling route plugins
- add focused authorization-helper coverage for scope enforcement, user access checks, project-owner/admin bypass paths, membership-based access, and project-not-found handling
- fix `GET /projects/:projectId` so project members inherit the same membership-aware access policy as other project-scoped routes, with route tests covering member and non-member cases
- make `GET /users/:userId/projects` return membership-accessible projects as well as owned projects, with route coverage for member-visible project listing
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
- keep redeploy failures on the current project/deployment page by threading a safe return path through deployment actions and rendering local action toasts on those detail views
- keep project/deployment detail pages usable when log reads fail by degrading only the log panels and showing explicit inline live-data guidance
- apply the same partial log-read degradation to the global and project-scoped logs pages so selectors and export controls remain usable during log-history outages
- keep dashboard platform health visible even when `NEXT_PUBLIC_DEMO_USER_ID` is unset by decoupling queue/worker health reads from project-scoped live-data requirements
- keep the status page honest under partial outages by showing live platform health while marking deployment-history metrics as unavailable instead of implying there is simply no deployment history
- clarify compose quick start requirements for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `ENCRYPTION_KEY`, optional dashboard auth variables, and the separation from app-local `.env` files
- align the production-readiness audit wording with the current compose/auth defaults so it no longer describes compose as enabling dev auth by default
- recalibrate the top-level phase snapshot in `docs/progress.md` so the reported phase-left percentages reflect the work already landed during this hardening pass
- align README auth wording with the current membership-aware project access model
- document the current cancellation semantics and refresh progress wording so `ENABLE_DEV_AUTH`, `API_TOKENS_JSON`, and `stopped` status references match the implementation
- make `apps/api/.env.example` explicitly show `ENABLE_DEV_AUTH=false` alongside the bootstrap token fallback example

## Tests Run

- `npm --workspace @vcloudrunner/api test`
  - passed (`68/68`); required elevated execution in this environment because the default Windows sandbox hit `spawn EPERM`
- `npm run typecheck`
  - passed
