# Vcloudrunner MVP Progress Tracker

Last updated: 2026-03-29 (Managed Postgres operations batch)

## Legend

- [x] Done
- [~] In progress / partial
- [ ] Not started



## Phase Status Snapshot (2026-03-29)

- **Phase 1: Critical stabilization** — ~99% complete
  - done: deployment concurrency invariant (service + DB), queue enqueue failure mapping/state correction, deployment-create env-resolution failure correction so decrypt/read failures no longer strand active deployments, queued-cancel race/idempotency hardening, safer compose defaults, production dev-auth startup guard, stricter bootstrap token startup validation, strict env-boolean parsing for auth/ingress and worker archive-lifecycle flags, strict numeric env parsing for API/worker runtime settings so blank strings no longer coerce to `0`, telemetry startup that now honors the same boolean env semantics as the validated config layer, explicit rejection of invalid credentials during dev-auth fallback flows, root auth/error plugin inheritance fix, host-run worker `.env` loading that now matches the documented app-local override flow, cwd-independent repo-root env resolution for API/worker startup and API `drizzle-kit` commands, aligned `drizzle-kit` env loading/fail-fast behavior with the API runtime, pinned compose API dev auth off independently from local host-run `.env` settings, stricter Redis queue URL parsing so explicit database paths must be integer indexes instead of silently coercing invalid values, broader API auth/deployment regression coverage, fuller api-token route access coverage, and clearer dashboard auth/config failure states
  - left (~1%): rotate any legacy local secrets in existing environments, keep reducing bootstrap-only auth fallback usage in regular dev flows, and add a small amount of end-to-end compose/runtime validation beyond unit coverage
- **Phase 2: Production readiness foundation** — ~99% complete
  - done: improved failure taxonomy coverage, regression tests around constraint/error mapping paths, stronger cancellation/auth/config resilience under partial failures, direct route-level authorization coverage across the main API surfaces including SSE log streaming, the full deployment write/cancel path, the full API-token list/rotate/revoke path, the full environment read/write path, and the full top-level project read/write path, alert-monitor/operational-threshold unit coverage, idempotent alert-monitor startup behavior, overlap-safe alert-monitor polling during slow evaluations, fail-fast alert webhook delivery under network hangs, timeout-normalized alert/webhook/control-plane delivery failures across alert webhooks, deployment lifecycle webhooks, Caddy route updates, and GCS token exchange, idempotent worker background scheduler startup behavior, overlap-safe worker background task scheduling during slow sweeps, overlap-safe live-log SSE polling during slow log queries, fail-fast Caddy route updates with stable network-failure reporting, normalized deployment lifecycle webhook delivery under blank-url and network-failure cases, normalized archive upload and GCS token-fetch network failures under retry/timeout conditions, post-upload local archive cleanup that now degrades to a warning instead of downgrading a successful remote upload, best-effort deployment-log retention enforcement after worker state/log writes so secondary log trimming failures no longer turn successful transitions into job failures, best-effort failure/stop audit-log insertion after worker state transitions so post-status log insert failures no longer poison otherwise successful lifecycle writes, best-effort worker audit logging across pre-run, retry-scheduled, and post-run phases so informational log insert failures no longer override the real deployment outcome, best-effort worker deployment-event emission after authoritative state changes so lifecycle event sink failures no longer override the real build/running/failed outcomes, cancellation finalization safety fallbacks so cancelled worker jobs are best-effort marked `failed` when runtime cleanup succeeds but the final `stopped` persistence write still fails, consistent `deployment.cancelled` event emission for cancellation completions before execution, during execution, and after execution-error finalization, cancellation cleanup enforcement so worker jobs no longer finalize as `stopped` when runtime teardown still fails, runtime-cleanup failure propagation that now distinguishes real teardown failures from already-gone container/image races during cancellation finalization, startup-failure runtime cleanup propagation that now preserves the original deployment error context while surfacing real container/image teardown failures from the runner path, best-effort runtime and Caddy route cleanup after post-run persistence failures so torn-down deployments no longer leave live containers/images or stale reverse-proxy routes behind, per-item continuation across worker reconciliation/archive/upload/cleanup sweeps so one bad deployment or corrupted local artifact no longer aborts the full pass, per-item continuation across stale pre-run container cleanup so one failing old container removal no longer blocks later cleanup candidates, per-alert continuation inside operational alert evaluation so one failing webhook send no longer suppresses later alerts in the same cycle, per-signal continuation inside operational alert evaluation so broken queue metrics or worker-health reads no longer suppress alerts from the other source in the same cycle, normalized malformed GCS token success responses so invalid JSON and bad `expires_in` values no longer leak parser failures or poison the worker token cache, direct API health/shutdown regression coverage, fuller worker-health failure mapping and shutdown-resilience coverage in `buildServer()`, direct server-metrics contract coverage with explicit unavailable mapping, explicit ingress-contract coverage for allowlisted CORS plus global rate-limit headers/throttling, explicit `403` handling for disallowed CORS origins, proxy-aware forwarded-client rate-limit handling via configurable trusted-proxy support, preserved plugin-provided operational status codes like rate-limit `429` through the shared error handler, deterministic API and worker test bootstrap env fixtures that no longer inherit local developer `.env` values, startup/shutdown lifecycle hardening around the API and worker bootstrap paths, retryable worker ready-handling after synchronous scheduler-start failures, startup-failure cleanup even when API telemetry initialization itself throws, guarded worker startup work against repeated `ready` events, stricter integer parsing on live-log route query controls, worker deployment-network creation that now tolerates “already exists” races during startup, and clearer operator-facing startup/config guidance
  - left (~1%): deeper observability dimensions, migration safety gates, backup/restore automation checks, worker/service decomposition, and broader operational validation
- **Phase 3: UI/UX trust and polish** — ~100% complete
  - done: route architecture, loading/error boundaries, action feedback helpers, clearer deployment error messages, stopped-status consistency, in-context failure handling, live-data unavailable/degraded states across the dashboard, platform-health visibility even when project-scoped live data is unavailable, clearer status-page behavior under partial outages, more truthful platform-health badge semantics, preserved worker stale/unavailable distinctions, more accurate demo-mode/live-data messaging on top-level pages, timeout-bounded dashboard live-data/log-proxy fetching so hung upstream calls degrade into explicit timeout states instead of hanging route rendering, overlap-safe client-side queue-health polling for operational widgets, pending-aware/visibility-aware auto-refresh loops for deployment and log views, visibility-aware live log streaming with replay-safe resume behavior plus in-panel reconnect recovery, terminal-state-aware log streaming so stopped/failed deployments now keep historical logs visible without pretending to be actively streaming, terminal-state-aware log auto-refresh so stopped/failed deployments no longer keep polling the route while saying no new live logs are expected, partial-outage-aware global deployment/history loaders so one failing project no longer blanks top-level dashboard views, partial-outage-aware project detail panels so deployment or environment read failures no longer take down the full project page, project-scoped deployment/environment/log routes that now stay usable when their secondary live-data reads fail, a global environment shortcut that now stays live when the selected project’s variable read fails, deployment detail routing that no longer turns partial-outage misses into false not-found states, token settings that now keep creation available when the token inventory read fails, deployment detail pages that now explicitly disclose surrounding history outages when the current deployment remains available, status-page outcome summaries that now stay terminal-only, truthful operational-card labeling for running-deployment recency, and cancellation-requested deployment states that now show an explicit `cancelling` cue plus updated queued/building/stopped guidance across detail, summary, log-selector, project-overview, operational-metric, global-filter, and plain-text detail surfaces instead of masquerading as normal in-progress work
  - left (~0%): core UI/UX trust and polish goals are complete; only optional future polish remains
- **Phase 4: Extensibility and platform maturity** — ~100% complete
  - done: API route and service composition (removing module-level singletons in favor of injected factories in fastify plugins), runtime and deployment lifecycle seams exist, basic domain boundaries are in place, worker runtime execution plus runtime-health inspection now share an adapter/factory seam instead of hard-wiring bootstrap reconciliation to Docker, worker ingress management now also goes through an explicit seam instead of naming `CaddyService` directly, lifecycle event emission now depends on an event-sink seam instead of a raw webhook-emitter function, archive upload request/auth logic now goes through a dedicated provider seam instead of living inside deployment state management, that archive upload request/auth layer is now further split into provider-specific `http`/`s3`/`gcs`/`azure` adapters behind a registry-driven selector instead of one branching class, deployment-log archive encoding/compression now also goes through a dedicated archive-builder seam instead of living inline inside the state service, worker outbound HTTP transport now also goes through a shared client seam instead of letting Caddy route updates, lifecycle webhooks, archive uploads, and GCS token exchange each hand-roll their own timeout and fetch logic, worker archive-upload composition now also goes through dedicated factories instead of letting the configured provider, GCS auth adapter, and configured uploader self-compose registries or HTTP clients inline, worker shell command execution now goes through a deployment-command-runner seam instead of living inline inside runtime orchestration, worker container/network lifecycle now also goes through a runtime-manager seam instead of binding `DeploymentRunner` straight to `dockerode`, worker Caddy service plus Docker runtime executor/inspector/manager composition now also goes through dedicated adapter-specific factories instead of letting those concrete infrastructure adapters self-compose outbound HTTP, deployment-runner, or Docker-client dependencies inside their constructors, worker workspace preparation/cleanup now goes through a workspace-manager seam instead of living inline inside runtime orchestration, build-file repository inspection now goes through a repository-file-inspector seam instead of letting Dockerfile detection shell out to git directly, build-system resolver, Dockerfile detector, and configured image-builder composition now also go through dedicated factories instead of self-composing detector lists, repository inspectors, command runners, or resolvers inside their constructors, local archive file handling now also goes through a deployment-log-archive-store seam instead of living inline inside deployment state management, build-system resolution now also goes through a dedicated resolver seam instead of letting `DeploymentRunner` call a static detector registry directly, the default build-detector list now also goes through a dedicated detector factory instead of being hard-wired inline inside the configured resolver, raw process-launch behavior for repository inspection and shell deployment commands now also goes through a shared exec-file runner seam instead of naming `execFile` separately inside each adapter, repository clone plus image-build orchestration now also goes through a deployment-image-builder seam instead of living inline inside `DeploymentRunner`, archive upload transport/retry behavior now also goes through a deployment-log-archive-uploader seam instead of living inline inside deployment state management, worker deployment-state construction now also goes through a factory seam instead of being named directly in the job processor and bootstrap composition roots, BullMQ deployment-worker construction now also goes through a dedicated factory seam instead of being hard-wired inline at the worker module boundary, deployment-worker default processor composition now also goes through a dedicated configured factory instead of letting the general worker factory self-compose a processor inline, worker bootstrap lifecycle composition now also goes through a dedicated configured factory instead of being wired inline in `index.ts`, worker background-scheduler plus heartbeat-Redis construction now also goes through a dedicated factory seam instead of being wired inline in the bootstrap entrypoint, deployment-state repository construction now also goes through a dedicated factory seam instead of being named directly inside state-service composition, deployment-state repository default queryable composition now also goes through a dedicated configured factory instead of letting the repository self-compose its database pool inside the constructor, deployment-state database-queryable / `pg` pool construction now also goes through a dedicated factory seam instead of living inline inside the repository, deployment-runner construction now also goes through a dedicated factory seam instead of being named directly inside the Docker runtime executor, deployment-runner default workspace/image/runtime collaborator composition now also goes through a dedicated configured factory instead of letting the runner self-compose those defaults inside its constructor, deployment-job-processor default dependency wiring now also goes through a dedicated factory seam instead of naming runtime/state/ingress/event/logger defaults inline inside the processor module, deployment-state-service default repository/ingress/archive collaborator wiring now also goes through a dedicated factory seam instead of being named inline inside the service constructor, Docker client construction now also goes through a shared factory seam instead of being named directly inside the Docker-backed runtime manager and inspector adapters, and duplicated worker runtime-family selection now also goes through a shared resolver seam instead of being repeated inline across the runtime executor, runtime inspector, and container-runtime-manager factories, while archive providers now use provider-native AWS/Azure SDK upload adapters plus `google-auth-library`-backed GCS token resolution instead of hand-rolled signing/token flows, and deployment-state service construction now also lives in a dedicated configured factory so the class itself no longer self-composes default collaborators, while heartbeat Redis, repository-file-inspector, deployment-state-queryable, Docker-client, outbound HTTP, Caddy service, webhook listener, ingress manager, deployment-log archive builder/store, and HTTP archive-provider default construction now also live behind dedicated configured or adapter-specific factories instead of being instantiated inline around the worker service graph, and worker queue Redis connection defaults now also go through dedicated configured and override-friendly factory seams instead of living as a module-level boundary constant
  - done recently: projects now carry explicit service-definition contracts with one primary public service plus internal-only services, the worker build/runtime path honors the selected service root for workspace preparation, Dockerfile detection, Docker build context, and runtime project paths, deployments can now explicitly target named services with a per-project/per-service active-deployment invariant instead of a project-wide active lock, the API now generates `VCLOUDRUNNER_SERVICE_*` discovery env vars plus stable internal hostnames for each project service, the worker runtime now attaches matching Docker network aliases for those generated service hosts, runtime/ingress behavior now only exposes public web services, the dashboard now composes project status from per-service deployment state while surfacing each service's current deployment status, latest deployment, and internal host through project and deployment views, the dashboard now resolves its live user context through an authenticated `/v1/auth/me` API path instead of treating `NEXT_PUBLIC_DEMO_USER_ID` as the primary identity source, the authenticated actor payload now reports auth source plus persisted user profile details when available, Settings now includes a dedicated account/session surface instead of keeping auth state only in the overview, the dashboard now supports an interactive per-user sign-in/sign-out flow backed by an httpOnly session cookie that overrides the old shared env-token fallback, top-level dashboard routes now distinguish sign-in-required / session-expired states from true live-data outages while returning re-auth flows to the operator's original page, the remaining project-scoped pages plus global logs/environment/token surfaces now use the same auth-aware unavailable handling while live log streaming and log-export proxy messaging steer operators back into session re-auth instead of silently normalizing env-token fallback, direct deployment-detail access plus the remaining project/token server-action viewer-resolution failures now also redirect through the same auth-aware session recovery path instead of generic top-level redirects or `no user context` handling, the platform now has its first real persisted-user bootstrap path so authenticated bootstrap/dev actors can create a stored profile and move into DB-backed token workflows without staying stuck in token-only identity, sign-in / session-controls / project-create / token-management flows now treat account setup as the normal bridge out of bootstrap/dev identity instead of leaving those actors stranded in half-configured write paths, the first persisted project-membership groundwork now exists through owner-membership seeding, member listing, existing-user invites, and a project detail members surface with invite controls, owners/admins/project-admins can now update non-owner member roles or remove non-owner memberships directly from the project page through the same persisted project-membership model, the platform now stores pending project invitations for non-persisted emails while automatically accepting matching invitations when that user completes account setup with the same email, pending invitations can now be refreshed or cancelled directly from the dashboard while account-setup success feedback names accepted project memberships more clearly, invitation records now preserve `pending` / `accepted` / `cancelled` history with shareable claim links plus a dedicated dashboard claim page instead of disappearing on acceptance or cancellation, and project ownership can now be transferred explicitly to an existing member while keeping that operation owner-only and leaving the previous owner behind as a normal admin member
  - left (~0%): the current four-phase MVP plan is complete; broader auth/team maturity, richer outbound delivery providers, runtime adapter expansion, and advanced day-2 tooling now belong to the next planning pass rather than the original phase checklist

## Implementation Log

### Phase: Managed Postgres operations batch (2026-03-29, persisted runtime health + health-aware reconcile + credential rotation + operator guidance)

- what was built:
  - extended the managed Postgres control-plane model with persisted runtime-health telemetry, including current health state/detail, health timing, consecutive failure tracking, and credential-rotation timing, so the platform now distinguishes “provisioned” from “runtime healthy” instead of treating those as the same thing
  - taught the managed Postgres provisioner seam to run runtime credential health checks and safe credential rotation with rollback-on-verification-failure, keeping the API truthfully aware of unreachable runtimes, rejected credentials, and post-rotation redeploy requirements instead of only reporting database-creation success
  - upgraded managed database reconcile to refresh both provisioning state and runtime-health state together, so a ready database now comes back with an explicit runtime-health result instead of a stale provisioning-only status
  - added a dedicated credential-rotation API route and dashboard action, keeping that write path behind the same project-admin membership-management boundary as other managed database controls instead of burying password changes inside generic reconcile behavior
  - expanded the dashboard Databases page and shared summary helpers to surface provisioning badges, runtime-health badges, last-check / last-healthy / last-error timing, persistent failure counts, rotation timing, and operator-facing warnings about redeploys plus the still-missing backup/restore automation
  - refreshed the top-level README operator notes and API endpoint inventory to document runtime-health-aware reconcile, credential rotation, and the current backup/restore limitation for managed Postgres
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0025_managed_project_database_operations.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/services/managed-postgres-provisioner.service.ts`
  - `apps/api/src/modules/project-databases/project-databases.repository.ts`
  - `apps/api/src/modules/project-databases/project-databases.routes.ts`
  - `apps/api/src/modules/project-databases/project-databases.routes.test.ts`
  - `apps/api/src/modules/project-databases/project-databases.service.ts`
  - `apps/api/src/modules/project-databases/project-databases.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-databases.ts`
  - `apps/dashboard/app/projects/[id]/databases/actions.ts`
  - `apps/dashboard/app/projects/[id]/databases/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - managed Postgres now has a much more truthful lifecycle surface, but backup scheduling, restore workflow, storage sizing controls, and longer-horizon incident/audit visibility are still missing
  - only managed Postgres is modeled today; MongoDB and Redis still belong to later managed-data slices after the Postgres lifecycle is sturdier
- next recommended step:
  - continue managed databases v1 with backup scheduling / restore scaffolding plus operator-facing recovery/audit visibility for managed Postgres before expanding the managed-data surface to MongoDB or Redis

### Phase: Managed Postgres groundwork batch (2026-03-29, first-class project database model + configurable provisioning seam + linked-service env injection + dashboard surface)

- what was built:
  - added the first managed-data resource model to the control plane with persisted `project_databases` plus per-service links, so projects can now carry first-class managed Postgres resources instead of relying only on hand-managed environment variables
  - added a configurable managed Postgres provisioner seam backed by `MANAGED_POSTGRES_ADMIN_URL` plus runtime host/port/ssl settings, so the API can create logical databases and roles when admin access is configured while still reporting truthful `pending_config`, `ready`, and `failed` states when it is not
  - added project-scoped managed database API routes for list/create/reconcile/delete and linked-service updates, keeping them behind the existing project access and project-admin membership-management boundaries instead of burying database actions inside generic project route logic
  - taught deployment creation to inject generated managed Postgres connection variables into the selected service when that service is linked to a ready managed database, so linked services now receive stable keys like `<NAME>_DATABASE_URL` automatically on deploy without copying secrets into the normal env-variable store
  - extended the worker runtime path with optional shared-platform network attachment and pinned the compose default network name to `vcloudrunner-platform`, so the generated managed Postgres connection strings are truthful for the bundled single-node stack instead of assuming unreachable control-plane hostnames
  - added a dedicated project Databases page plus project-overview/subnav surfacing in the dashboard, including create/retry/delete actions, linked-service controls, generated env-key visibility, and masked credential / connection-string display
  - refreshed the top-level README, architecture notes, compose env wiring, and app-local env examples to document the new managed Postgres operator flow and config knobs
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/worker run typecheck`, `npm.cmd --workspace @vcloudrunner/worker test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `docs/architecture.md`
  - `docker-compose.yml`
  - `apps/api/.env.example`
  - `apps/api/drizzle/0024_managed_project_databases.sql`
  - `apps/api/src/config/env-core.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/services/managed-postgres-provisioner.service.ts`
  - `apps/api/src/modules/project-databases/project-databases.repository.ts`
  - `apps/api/src/modules/project-databases/project-databases.routes.ts`
  - `apps/api/src/modules/project-databases/project-databases.routes.test.ts`
  - `apps/api/src/modules/project-databases/project-databases.service.ts`
  - `apps/api/src/modules/project-databases/project-databases.service.test.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/worker/.env.example`
  - `apps/worker/src/config/env-core.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/services/deployment-runner.test.ts`
  - `apps/worker/src/services/runtime/container-runtime-manager.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-databases.ts`
  - `apps/dashboard/components/project-subnav.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/projects/[id]/databases/actions.ts`
  - `apps/dashboard/app/projects/[id]/databases/page.tsx`
  - `packages/shared-types/src/index.ts`
  - `docs/progress.md`
- what is still missing:
  - managed databases now have a real first-class model and can provision logical Postgres resources when configured, but Postgres follow-through is still missing deeper health checks, storage sizing enforcement, credential rotation, backup scheduling, restore flow, and broader incident/audit visibility
  - only managed Postgres is modeled today; MongoDB and Redis still belong to later managed-data slices after the Postgres lifecycle is sturdier
- next recommended step:
  - continue managed databases v1 with Postgres follow-through: add health/reconcile telemetry, credential rotation, backup schedule + restore scaffolding, and clearer operator warnings before expanding the managed-data model to MongoDB or Redis

### Phase: Roadmap certificate recovery-history batch (2026-03-29, trust/path event telemetry + persisted incident/recovery summaries + operator-facing recovery drill-down)

- what was built:
  - extended the persisted project-domain event model with explicit `certificate_trust` and `certificate_path_validity` event kinds, so hostname/trust regressions and issuer-path date problems now have first-class event history instead of only appearing as current-state diagnostics
  - taught the domain refresh path to emit those trust/path events only when real certificate incidents, recoveries, or tracked issuer-path warning states occur, while keeping the existing higher-level certificate guidance and attention history intact
  - added an event-backed certificate-history summary contract per host, so each domain now exposes tracked history counts, incident/recovery totals, issuer-path renewal-warning counts, per-category incident breakdown, and the latest incident/recovery timing without depending on fragile UI-only heuristics
  - expanded the Domains page to surface certificate-history rollups in the route summary plus a per-host recovery-history drill-down, making it much easier to see whether a host has recurring trust/path/follow-up issues even when the latest check is no longer the first or only signal
  - updated recent domain-activity labeling so the dashboard can show trust and issuer-path date transitions directly instead of collapsing everything into generic certificate wording
  - refreshed the top-level README capability list to mention event-backed certificate trust / issuer-path recovery history as part of the custom-domain workflow
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0023_project_domain_event_certificate_history.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - domains/TLS now preserve claim, DNS, TLS, trust, issuer-path, and certificate follow-up history much more truthfully, but the platform still does not provide managed ACME-style issuance / renewal automation, provider-driven certificate controls, or the next broader platform capabilities like managed data services
- next recommended step:
  - treat roadmap item 3 as sufficiently mature for now and move to the next broader roadmap area, starting with managed databases v1 groundwork (resource model, instance lifecycle, generated credentials/env injection, and dashboard/API surfaces)

### Phase: Roadmap certificate-path validity telemetry batch (2026-03-29, per-certificate validity windows + issuer-path incident timeline + renewal-aware operator guidance)

- what was built:
  - extended stored presented-chain entries with per-certificate validity windows, so issuer-path snapshots now preserve each certificate's own `validFrom` / `validTo` timing instead of only the leaf certificate's dates
  - added a derived certificate-path-validity contract on top of that stored chain metadata, so each host now reports whether the full presented issuer path is `valid`, `expiring-soon`, `expired`, `not-yet-valid`, or `unavailable` rather than hiding intermediate-certificate date issues behind leaf-only validity checks
  - added persisted issuer-path-validity timeline fields on domains, so the control plane now tracks when the current path-validity state began, how many consecutive checks have observed it, and when the last fully in-date issuer path was confirmed
  - wired certificate guidance to the new path-validity contract, so expiring or broken intermediate/root certificates now push operators into `renew-soon` / `renew-now` guidance instead of incorrectly reading as healthy just because the served leaf certificate still has time remaining
  - updated the dashboard Domains page to surface issuer-path date badges, summary counts, timeline copy, and per-certificate validity details for both the current presented chain and the last healthy issuer-path snapshot
  - refreshed the top-level README capability list to mention intermediate-certificate validity surfacing as part of the custom-domain workflow
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0022_project_domain_certificate_path_validity.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - domains/TLS now expose issuer-path validity much more truthfully, but the platform still does not preserve a longer-horizon renewal / issuer incident timeline beyond current-state streaks and recent events, and it still does not offer managed ACME-style issuance / renewal automation beyond observed DNS / HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with longer-horizon renewal / issuer incident history plus deeper recovery drill-down on the Domains page, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling

### Phase: Roadmap certificate issuer-path history batch (2026-03-29, structured chain entries + last-healthy snapshots + operator-facing issuer-path drift history)

- what was built:
  - extended stored project-domain diagnostics with structured per-certificate chain entries, so each host now preserves subject, issuer, fingerprint, serial, and self-issued metadata for the full presented chain instead of flattening chain visibility down to subject-name lists
  - taught the TLS diagnostics path to capture those structured chain entries from the peer certificate, carry them through stored diagnostics, and reuse them during background refreshes instead of treating detailed issuer-path data as a transient request-time-only observation
  - added a last-known-healthy chain snapshot on top of the current presented chain, so the control plane now keeps the most recent trusted issuer path available for truthful comparison after later regressions or suspicious path changes
  - derived an explicit certificate-chain-history contract with `stable`, `rotated`, `degraded`, `drifted`, `baseline-missing`, and `unavailable` states so operators can distinguish healthy issuer rotation from drift away from the last healthy chain or hosts that have never presented a trusted baseline
  - taught project-domain event history to compare structured chain entries instead of subject-only lists, which keeps `certificate_chain` history truthful when issuer path, serial, fingerprint, or self-issued characteristics change without a simple subject-name delta
  - updated the dashboard Domains page to surface chain-history badges, current presented-certificate snapshots, last-healthy chain snapshots, and summary counts for healthy rotations, regressions, and missing trusted baselines
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0021_project_domain_certificate_chain_entries.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now preserves issuer-path snapshots much more truthfully, but it still does not expose full longer-horizon renewal history, richer intermediate-certificate validity/issuer telemetry beyond the captured presented-path metadata, or a managed ACME-style issuance / renewal control loop beyond observed DNS / HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with deeper renewal / issuer incident history and richer per-certificate validity surfacing for intermediates, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling

### Phase: Roadmap certificate chain recovery telemetry batch (2026-03-29, chain timeline persistence + intermediate issuer metadata + recovery-aware operator guidance)

- what was built:
  - extended stored project-domain diagnostics with presented-chain timeline fields, so each host now preserves when the current chain state began, how many consecutive checks have observed it, and when a full trusted chain was last confirmed
  - expanded the derived certificate-chain contract with intermediate-issuer names and chain depth, so the control plane can expose more than a flat subject list when operators need to inspect how a host is being served
  - added a chain-specific follow-up contract on top of that stored timeline, with healthy / monitor / action-needed / persistent-action-needed states so chain problems can become explicitly persistent even when the served chain itself has not changed
  - taught project-domain event history to emit `certificate_chain` events on status-only recoveries or regressions even when the presented subject list stays the same, which keeps chain history truthful when trust changes instead of the raw chain payload
  - updated the dashboard Domains page to surface chain follow-up badges, persistent chain-issue counts, intermediate issuer detail, chain depth, and last-healthy chain timing so operators can see both what is being served and how long chain issues have persisted
  - refreshed the top-level README capability list to mention chain recovery history as part of the custom-domain workflow
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0020_project_domain_certificate_chain_timeline.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now tracks presented-chain persistence and recovery much more truthfully, but it still does not preserve full per-certificate intermediate metadata beyond subject names, richer issuer drift / renewal incident history, or a managed ACME-style issuance / renewal control loop beyond observed DNS / HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with richer per-certificate issuer/intermediate metadata plus longer-horizon renewal / issuer incident history, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate chain diagnostics batch (2026-03-29, presented chain capture + chain-status derivation + operator-facing root/issuer detail)

- what was built:
  - extended stored project-domain diagnostics with persisted presented-certificate chain subjects plus the observed root subject, so each host now preserves more truthful issuer-chain context instead of flattening HTTPS checks down to only leaf-certificate metadata
  - taught the TLS diagnostics path to capture the presented certificate chain from the peer certificate, carry that state through stored domain diagnostics, and reuse it during background refreshes instead of treating chain visibility as transient request-time-only detail
  - added an explicit certificate-chain contract on top of the stored diagnostics, with statuses like `chained`, `leaf-only`, `incomplete`, `private-root`, `self-signed-leaf`, and `unavailable`, so operators can distinguish healthy presented chains from suspicious or incomplete certificate paths
  - extended project-domain event history with `certificate_chain` events derived from observed chain changes, so the Domains page now records when a host starts presenting a different certificate chain instead of only tracking DNS, trust, and certificate-identity transitions
  - updated the dashboard Domains page to surface certificate-chain badges, chain summary counts, root-subject detail, and a readable presented-chain display for each host, making issuer/root context far easier to inspect during certificate troubleshooting
  - refreshed the top-level README capability list to mention presented-chain visibility as part of the custom-domain workflow
  - verified the batch with `npm.cmd --workspace @vcloudrunner/api run typecheck`, `npm.cmd --workspace @vcloudrunner/api test`, `npm.cmd --workspace @vcloudrunner/dashboard run typecheck`, and `npm.cmd --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0019_project_domain_certificate_chain.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now exposes presented certificate chain visibility much more truthfully, but it still does not preserve full intermediate-certificate metadata beyond subject names, deeper issuer/renewal incident history, or a managed ACME-style issuance/renewal control loop beyond observed DNS / HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with richer issuer/intermediate-chain metadata plus longer-horizon certificate recovery history, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate attention telemetry batch (2026-03-29, guidance streak tracking + persistent certificate issue surfacing + operator-facing follow-up state)

- what was built:
  - extended stored project-domain diagnostics with persisted certificate-guidance timeline fields, so each host now keeps when the current certificate follow-up state began plus how many consecutive checks have observed that same state
  - added an explicit certificate-attention contract on top of the existing lifecycle / trust / validity guidance, with `healthy`, `monitor`, `action-needed`, and `persistent-action-needed` states so operators can distinguish expected watch states from certificate problems that are now clearly persisting
  - taught the domain refresh path to carry that guidance timeline forward across repeated checks and emit explicit `certificate_attention` history events when real certificate issues escalate or resolve, instead of only recording raw guidance-state changes
  - updated the dashboard Domains page to surface certificate follow-up badges, summary counts, persistent-issue wording, and per-host “current follow-up state since / across N consecutive checks” guidance so stuck renewal or trust problems are much harder to miss
  - refreshed the top-level README capability list to mention persistent certificate issue surfacing as part of the custom-domain workflow
  - verified the batch with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0018_project_domain_certificate_attention.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - certificate follow-up is now much more truthful at the control-plane and dashboard level, but the platform still does not expose full presented issuer-chain detail, repeated issuer-chain drift history, or a managed ACME-style issuance / renewal control loop beyond observed DNS / HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with deeper certificate chain / issuer detail plus richer certificate recovery history, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate identity and rotation telemetry batch (2026-03-29, fingerprint/serial capture + rotation history + operator-facing identity guidance)

- what was built:
  - extended stored project-domain diagnostics with presented-certificate fingerprint and serial capture, so the control plane now preserves stable certificate identity instead of treating every HTTPS check as an isolated snapshot
  - taught the TLS inspection path to record certificate fingerprint/serial details directly from the presented certificate and persist first-observed, changed-at, and last-rotated timestamps on each domain record
  - added an explicit certificate-identity contract on top of that stored state, with statuses like `first-observed`, `stable`, `rotated`, `rotated-attention`, and `unavailable`, so operators can tell the difference between healthy rotation, suspicious rotation, and simple lack of cert data
  - extended project-domain event history with `certificate_identity` events derived from fingerprint changes, so the Domains page now has a truthful rotation trail instead of only DNS / HTTPS / trust transitions
  - updated the dashboard Domains page to surface certificate-identity summary counts, per-host identity badges, fingerprint and serial details, identity timing/history copy, and richer recent-activity details for certificate changes
  - refreshed the top-level README capability list to mention certificate rotation telemetry as part of the custom-domain workflow
  - verified the batch with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0017_project_domain_certificate_identity.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now exposes certificate identity, trust, expiry risk, and operator next steps much more truthfully, but it still does not model full issuer-chain detail, repeated renewal-failure history, or managed ACME-style issuance/renewal automation beyond observed certificate and HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with deeper certificate history / renewal telemetry such as issuer-chain detail and repeated renewal-failure surfacing, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate trust and guidance batch (2026-03-29, persisted cert metadata + trust guidance + certificate events)

- what was built:
  - extended stored project-domain diagnostics with richer certificate metadata, including presented subject, issuer, SAN coverage, and a normalized validation-reason field, so the control plane can now preserve more than just TLS reachability and validity dates
  - taught the domain diagnostics path to capture that metadata from the presented TLS certificate and classify trust failures like hostname mismatch, self-signed/untrusted issuer, and date-invalid certificate problems instead of collapsing every failure into a generic invalid-TLS message
  - added explicit certificate-trust and certificate-guidance contracts on top of the stored diagnostics, so each host now reports whether the cert is trusted, mismatched, untrusted, date-invalid, or unavailable plus a next-step state like `renew-now`, `renew-soon`, `fix-coverage`, `fix-trust`, `wait-for-issuance`, or `healthy`
  - extended domain event history with certificate events derived from the guidance contract, so the Domains page now has a real certificate activity trail instead of only DNS and raw HTTPS-status transitions
  - updated the dashboard Domains page to surface the new trust/guidance badges, issuer/subject/coverage details, validation reason, and summary counts for trust issues plus renewal attention, making certificate recovery work much more operator-readable
  - refreshed the top-level README capability list to mention custom-domain TXT/DNS/TLS/certificate management directly
  - verified the batch with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `README.md`
  - `apps/api/drizzle/0016_project_domain_certificate_metadata.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now exposes certificate identity, trust, expiry risk, and operator next steps much more truthfully, but it still does not model full issuer-chain detail, renewal attempt history, or managed ACME-style issuance/renewal automation beyond observed certificate and HTTPS diagnostics
- next recommended step:
  - either continue roadmap item 3 with deeper certificate history / renewal telemetry (for example full chain detail, last-renewal-style eventing, or repeated-failure surfacing), or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate validity-window surfacing (2026-03-29, persisted cert dates + expiry guidance)

- what was built:
  - added persisted certificate validity-window storage on project domains, so diagnostics can keep the presented certificate `validFrom` / `validTo` dates instead of collapsing HTTPS health to a boolean-style status only
  - extended the project-domain diagnostics path to inspect the presented TLS certificate and capture those validity dates alongside the existing DNS / HTTPS readiness checks
  - derived an explicit certificate-validity contract on top of the stored dates, with states like `valid`, `expiring-soon`, `expired`, `not-yet-valid`, and `unavailable`, so operators can tell whether HTTPS is healthy but nearing expiry versus already broken
  - surfaced certificate-validity badges, summary counts, and the concrete valid-from / valid-until timestamps on the dashboard Domains page, so domain operations now expose actual certificate windows instead of only route/claim/provisioning guidance
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0015_project_domain_certificate_validity.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now surfaces certificate validity windows and near-expiry risk, but it still does not expose richer issuer / chain detail or a fuller managed ACME-style renewal workflow beyond presented-certificate inspection and health-check-based inference
- next recommended step:
  - either continue roadmap item 3 with richer certificate issuer / chain / renewal-history surfacing, or treat domains/TLS as sufficiently mature for now and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap certificate lifecycle guidance (2026-03-28, explicit issuance/renewal state + operator guidance)

- what was built:
  - added a derived certificate-lifecycle contract to project-domain responses, with explicit states like `awaiting-route`, `awaiting-dns`, `provisioning`, `active`, `issuance-attention`, `renewal-attention`, and `check-unavailable`, so HTTPS no longer stops at raw `tlsStatus`
  - taught the project-domain service to distinguish initial certificate issuance trouble from regressions after prior healthy HTTPS by reusing the existing `tlsReadyAt` and TLS status-change tracking, which makes renewal issues visible without inventing a separate certificate store
  - surfaced the new lifecycle badges, summary counts, and operator-facing "Certificate lifecycle" guidance on the dashboard Domains page, so operators can quickly tell whether a host is blocked on routing, blocked on DNS, still provisioning, or needs issuance/renewal follow-up
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - certificate lifecycle is now explicit at the control-plane level, but the platform still does not surface live certificate validity windows / expiry dates or run a fuller managed ACME-style issuance and renewal workflow beyond health-check-based inference
- next recommended step:
  - either continue roadmap item 3 with explicit certificate validity-window / expiry surfacing, or treat the current domains/TLS pass as sufficiently mature and move to the next broader roadmap area such as managed databases or richer operator tooling
### Phase: Roadmap DNS challenge claim loop (2026-03-28, persisted TXT ownership challenge + explicit verify flow)

- what was built:
  - added a persisted per-domain TXT ownership challenge model for custom hosts, including stored verification tokens plus verification status/detail/timestamp state on the `domains` record, so custom-domain claims now have a first-class challenge contract instead of relying only on passive guidance
  - extended the project-domain diagnostics path to verify ownership through a `_vcloudrunner.<host>` TXT record while still separately checking routing DNS and HTTPS readiness, letting the platform distinguish claim verification, ingress-target DNS, and certificate health as separate steps in the domain lifecycle
  - added an explicit `POST /v1/projects/:projectId/domains/:domainId/verify` flow plus dashboard action/UI support, so operators can verify a single host on demand and get concrete claim-completion feedback instead of only running a broad refresh and inferring the result
  - updated the Domains page to show the TXT ownership challenge record, the routing CNAME target, richer claim-state badges, and per-host verify/recheck controls, so the dashboard now exposes the full manual challenge loop end to end
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0014_project_domain_verification.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - custom-domain claims now have a real TXT verification loop, but certificate issuance/renewal still only appears as best-effort HTTPS diagnostics rather than a richer managed lifecycle with clearer certificate state progression and recovery guidance
- next recommended step:
  - continue roadmap item 3 by deepening certificate issuance/renewal lifecycle tracking and operator guidance on top of the now-complete TXT claim loop, so certificate problems become as explicit and actionable as claim verification
### Phase: Roadmap guided domain claim workflow (2026-03-28, operator-facing DNS action guidance)

- what was built:
  - extended the project-domain diagnostics API model with explicit claim guidance derived from the current route, DNS ownership, TLS status, and diagnostics freshness, so each host now reports a concrete next-step state like `configure-dns`, `fix-dns`, `wait-for-https`, `redeploy-public-service`, or `healthy`
  - taught the project-domain service layer to attach recommended DNS record instructions for custom hosts, including the expected record type, host label, and target value when the operator still needs to point the domain at the platform
  - surfaced that guidance on the dashboard Domains page with claim-state badges, operator-facing “Claim guide” messaging, and explicit DNS record instructions instead of leaving operators to infer the next action from raw DNS/TLS status alone
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now guides operators through the manual domain-claim path, but it still does not run a real DNS challenge/claim loop with stored verification tokens, explicit claim-state progression, or managed certificate issuance/renewal workflows beyond best-effort HTTPS diagnostics
- next recommended step:
  - continue roadmap item 3 by turning the guided claim model into a real DNS challenge/claim loop with explicit ownership-token generation, verification-state progression, and operator-facing claim completion feedback
### Phase: Roadmap domain diagnostics event history (2026-03-28, persisted DNS/TLS transition log)

- what was built:
  - added a persisted `project_domain_events` history model that records DNS and HTTPS status transitions per domain, so the platform now keeps a lightweight event trail instead of only the latest/current domain state
  - updated the project-domain diagnostics refresh path to write ownership and TLS events whenever a host moves into a new status, including the first recorded state and later drift/regression transitions
  - surfaced recent domain activity on the dashboard Domains page so each host now shows a short DNS/HTTPS transition timeline alongside the current freshness and drift messaging
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0013_project_domain_events.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project-domain diagnostics now include recent transition history, but the platform still does not run a fuller DNS challenge/claim workflow and still does not model certificate issuance/renewal as a richer managed lifecycle beyond best-effort HTTPS state observation
- next recommended step:
  - continue roadmap item 3 by deciding whether to turn the current event/history model into a more guided DNS claim workflow, or to move directly into a real DNS challenge/claim loop with operator-facing verification instructions and claim-state progression

### Phase: Roadmap domain diagnostics drift surfacing (2026-03-28, current-status timing + regression visibility)

- what was built:
  - extended stored project-domain diagnostics state with `ownership_status_changed_at` and `tls_status_changed_at`, so the platform now tracks when the current DNS and HTTPS status first began instead of only storing the latest status value
  - updated the project-domain diagnostics persistence flow so those status-change timestamps are backfilled on the first recorded state, preserved while a host stays in the same state, and reset when DNS/TLS move into a new status during later refreshes
  - surfaced that history on the dashboard Domains page with drift/regression summaries plus per-host timeline messaging like current-state duration, DNS drift after prior verification, and HTTPS regression after prior healthy checks
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0012_project_domain_status_history.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project-domain diagnostics now show freshness plus status-duration/regression timing, but the platform still only stores the current/latest domain state rather than a fuller certificate issuance/renewal or ownership event history, and there is still no explicit DNS challenge/claim workflow beyond guidance plus best-effort verification
- next recommended step:
  - continue roadmap item 3 by choosing between a fuller certificate/ownership event history model and a real DNS challenge/claim loop, depending on whether operator visibility or claim automation is the more valuable next milestone

### Phase: Roadmap domain diagnostics freshness surfacing (2026-03-28, explicit fresh/stale/unchecked host checks)

- what was built:
  - extended the project-domain API response model with explicit diagnostics freshness state derived from `diagnostics_checked_at`, so stored DNS and TLS results now distinguish `fresh`, `stale`, and `unchecked` instead of treating all recorded status as equally current
  - updated the project-domain service layer so freshness is applied consistently to fallback reads and live refresh writes, keeping the API contract aligned with the same staleness window already used by the background diagnostics refresher
  - surfaced diagnostics freshness badges, operator-facing freshness detail, and top-level stale/unrecorded counts on the dashboard Domains page, so latest-known DNS and certificate state is now visibly qualified instead of reading like guaranteed live truth
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project-domain diagnostics are now freshness-aware, but the platform still only stores the latest-known DNS/TLS state rather than a fuller certificate issuance/renewal or ownership-history timeline, and there is still no explicit DNS challenge/claim workflow beyond guidance plus best-effort verification
- next recommended step:
  - continue roadmap item 3 by deciding whether to deepen the freshness-aware model into explicit certificate/ownership history and drift surfacing, or move into a fuller DNS challenge/claim loop if that is the more valuable next platform milestone

### Phase: Roadmap recurring domain diagnostics refresh (2026-03-28, background DNS/TLS reconciliation + last-known-good timing)

- what was built:
  - added an API-side `ProjectDomainDiagnosticsRefreshService` that periodically refreshes stale project-domain diagnostics in bounded batches, so DNS and TLS state no longer depend only on someone opening the Domains page or clicking the manual refresh action
  - extended stored domain lifecycle state with `ownership_verified_at` and `tls_ready_at`, preserving the last-known successful DNS verification and last healthy HTTPS check even when a host later drifts into mismatch, pending, or invalid states
  - refactored the project-domain diagnostics path so the dashboard refresh action and the background refresher now share the same `ProjectsService` persistence flow instead of maintaining separate update logic
  - updated the Domains page to show the last-known DNS verification and HTTPS healthy timestamps alongside the latest diagnostics status, and clarified that diagnostics now refresh automatically in the background while still supporting on-demand checks
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0011_project_domain_diagnostics_lifecycle.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/config/env-core.ts`
  - `apps/api/src/config/env-core.test.ts`
  - `apps/api/.env.example`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/build-server.test.ts`
  - `apps/api/src/services/project-domain-diagnostics-refresh.service.ts`
  - `apps/api/src/services/project-domain-diagnostics-refresh.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now has recurring diagnostics and last-known-good timing, but it still only stores the latest known lifecycle state rather than a fuller certificate issuance/renewal history, and there is still no explicit DNS challenge/ownership workflow beyond guidance plus best-effort verification
- next recommended step:
  - continue roadmap item 3 by deciding how far the platform model should go beyond latest-known host state: either add explicit certificate/ownership history and richer freshness surfacing, or move into a fuller DNS challenge/claim loop if that better fits the next platform milestone

### Phase: Roadmap active custom-domain detach (2026-03-28, explicit live-route deactivation for removals)

- what was built:
  - replaced the old API-side "active custom domains cannot be removed yet" guard with an explicit live-route detach path for non-default hosts that are already attached to a deployment, so operators can now remove active custom domains without waiting for a redeploy or manual database cleanup
  - added an API-side Caddy admin route-deactivation service plus configuration plumbing (`CADDY_ADMIN_URL` in the API env/compose config), letting the control plane delete the live reverse-proxy host before it removes the domain claim from the database
  - kept the safety guard for queued/building deployments, because those jobs already carry a snapshotted `publicRouteHosts` list and could otherwise republish a just-removed host later in the same in-flight deployment
  - updated the dashboard Domains page and removal messaging so running or stale custom hosts can be removed directly, while queued/building hosts now explain that removal has to wait for the deployment to finish or be cancelled
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/services/project-domain-route.service.ts`
  - `apps/api/src/services/project-domain-route.service.test.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/config/env-core.ts`
  - `apps/api/.env.example`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docker-compose.yml`
  - `docs/progress.md`
- what is still missing:
  - DNS ownership and certificate state are now stored and removable routes can be detached safely, but certificate/verification data is still refreshed on demand rather than by a recurring reconciliation loop, and there is still no richer certificate issuance/renewal history beyond the latest recorded status
- next recommended step:
  - continue roadmap item 3 by building on the stored diagnostics model with richer certificate lifecycle tracking plus background DNS/TLS refresh/reconciliation instead of on-demand checks only

### Phase: Roadmap persisted domain diagnostics state (2026-03-28, stored DNS/TLS status + on-demand refresh)

- what was built:
  - extended the `domains` model with persisted ownership status, ownership detail, TLS status, TLS detail, and `diagnostics_checked_at`, so project-domain health is now part of first-class platform state instead of existing only as ephemeral read-time probes
  - updated the project-domain service flow so normal reads return stored diagnostics with safe fallbacks, while `includeDiagnostics=true` now performs a live DNS/TLS inspection and persists the refreshed state back onto each domain record for later reads
  - added a dashboard-side “Refresh Checks” action on the Domains page, so operators can explicitly refresh DNS and certificate checks on demand while the page otherwise renders the stored status plus the last recorded refresh time
  - kept route activation and detach behavior unchanged for this slice: active custom hosts still publish through the current ingress path, but the platform now has durable per-host verification/TLS status that can support the next removal/deactivation workflow cleanly
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0010_project_domain_diagnostics.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - active custom domains still cannot be detached safely through an explicit route-deactivation workflow, and certificate/verification state is still refreshed on demand rather than through background reconciliation or a richer certificate-history model
- next recommended step:
  - continue roadmap item 3 by adding live-route deactivation for active custom domains so removal no longer depends on the current safety guard, then follow with richer certificate lifecycle tracking on top of the stored diagnostics model

### Phase: Roadmap domain diagnostics follow-through (2026-03-28, DNS ownership + TLS visibility)

- what was built:
  - added a best-effort domain diagnostics service on the API that inspects public DNS resolution and HTTPS reachability for project hosts, so the control plane can now distinguish platform-managed hosts, verified custom DNS, pending/mismatched DNS, and basic TLS readiness/validation problems per host
  - extended `GET /v1/projects/:projectId/domains` with an opt-in `includeDiagnostics=true` mode, keeping the default route payload lightweight for general project dashboards while allowing the dedicated Domains page to request richer DNS/TLS state without turning every project listing into live network probes
  - updated the dashboard Domains page to request those diagnostics explicitly and surface them through readable DNS/TLS badges plus operator-facing detail text alongside the existing route/deployment status, so claimed custom domains no longer stop at a generic `pending` story
  - kept the diagnostics slice non-authoritative and read-time only for now: route activation is unchanged, but operators can finally see whether a host is unconfigured, pointed at the wrong target, waiting on HTTPS, or already serving a valid certificate
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/services/project-domain-diagnostics.service.ts`
  - `apps/api/src/services/project-domain-diagnostics.service.test.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - DNS ownership and TLS are still derived from best-effort read-time probes rather than persisted platform state, there is still no explicit DNS challenge/claim loop or certificate issuance history, and active custom domains still rely on the current removal guard instead of a full route-detach workflow
- next recommended step:
  - continue roadmap item 3 by turning host diagnostics into first-class platform state: add explicit DNS verification / certificate lifecycle tracking where possible, then add live-route deactivation so active custom domains can be detached safely instead of remaining guarded

### Phase: Roadmap custom-domain activation groundwork (2026-03-27, deployment route snapshots + worker ingress publish)

- what was built:
  - extended deployment queue payloads so the API now snapshots the public route host set for public-service deploys, including the reserved default host plus any claimed custom domains, instead of leaving the worker hard-wired to a single generated hostname
  - updated worker route activation so public deploys now publish every queued host through Caddy, persist the default host plus successfully activated custom hosts back onto the deployment/domain model, and clean up all configured hosts together during post-run failure handling and startup reconciliation
  - tightened domain lifecycle safety so custom domains now become live on the next successful public-service deployment, pending custom hosts stay truthful when per-host activation fails, and active/in-flight custom domains are blocked from removal until explicit live-route deactivation exists
  - refreshed the dashboard Domains page guidance and controls to match the new behavior: claimed custom domains publish on the next successful deploy, while live custom routes remain visible but temporarily non-removable
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/worker run typecheck`, `npm --workspace @vcloudrunner/worker test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `packages/shared-types/src/index.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/worker/src/workers/deployment-job-processor.ts`
  - `apps/worker/src/workers/deployment-job-processor.test.ts`
  - `apps/worker/src/services/deployment-state.repository.ts`
  - `apps/worker/src/services/deployment-state.repository.test.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - DNS ownership, certificate issuance/renewal, and explicit per-host TLS/problem state are still not first-class, and active custom domains currently rely on a safety guard instead of a full live-route deactivation/removal workflow
- next recommended step:
  - continue roadmap item 3 by adding DNS ownership plus TLS/certificate state on top of the now-live custom-host activation path, then follow with explicit live-route deactivation so active custom domains can be detached safely instead of remaining guarded

### Phase: Roadmap domains management groundwork (2026-03-27, custom-domain claim add/remove + pending state)

- what was built:
  - added the first write-side project-domain workflow on the API through `POST /v1/projects/:projectId/domains` and `DELETE /v1/projects/:projectId/domains/:domainId`, so owners/admins/project-admins can now claim or remove custom hosts directly from the control plane instead of treating routing as read-only metadata
  - extended project-domain state modeling with an explicit `pending` route status for claimed-but-not-yet-activated hosts, so undeployed custom domains no longer masquerade as healthy routing before ingress and TLS activation exist
  - taught the dashboard Domains page to manage custom domains with role-aware add/remove controls, clearer operator guidance about the current claim-first workflow, and explicit distinction between the reserved default platform host and removable custom hosts
  - introduced `PLATFORM_DOMAIN` into the API config layer so the control plane can consistently protect the platform-managed default hostname namespace while continuing to compute the expected generated host for each project
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/.env.example`
  - `apps/api/src/config/env-core.ts`
  - `apps/api/src/config/env-core.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - custom domains are stored as project claims today, but deployment payloads, worker ingress activation, and certificate lifecycle still only understand the default generated host; there is no DNS verification or first-class TLS status yet
- next recommended step:
  - continue roadmap item 3 by wiring claimed custom domains into deployment/runtime ingress activation, then add TLS/certificate state so the dashboard can distinguish claimed, active, and certificate-problem hosts

### Phase: Roadmap domains/routing visibility foundation (2026-03-27, real route status + project domains dashboard)

- what was built:
  - added a real project-domain read path on the API through `GET /v1/projects/:projectId/domains`, backed by persisted `domains` rows and joined deployment metadata so the control plane can now describe each published host with its target deployment, target port, runtime URL, and service metadata instead of leaving route visibility implicit
  - introduced computed route states (`active`, `degraded`, `stale`) in the project service layer so the dashboard can distinguish healthy public routing from running-without-runtime-url cases and stale host records that still point at stopped or failed deployments
  - added a dedicated project Domains page plus project-subnav entry in the dashboard, showing published hosts, route state, deployment linkage, runtime URL visibility, and service/exposure metadata for the current project's public routing surface
  - replaced the old hardcoded project hostname guess on the main dashboard surfaces with the real route summary when available, so project cards and the project overview now surface actual route state while still falling back to the expected default host when no route has been published yet
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/lib/project-domains.ts`
  - `apps/dashboard/lib/mock-data.ts`
  - `apps/dashboard/components/project-card.tsx`
  - `apps/dashboard/components/project-subnav.tsx`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/projects/[id]/domains/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the current domains slice is visibility-first and still read-only: there is no project-side add/remove domain workflow, no custom-domain claim/DNS verification loop, no first-class TLS/certificate state, and the runtime routing model is still centered on one default public host per project
- next recommended step:
  - continue roadmap item 3 by adding the first write-side domain workflow: project-scoped domain add/remove management with explicit claimed/pending/active guidance, then surface TLS/certificate state once the platform can manage more than the default generated host

### Phase: Phase 4 invitation delivery closeout (2026-03-27, outbound webhook delivery + redelivery controls)

- what was built:
  - added a minimal outbound invitation delivery seam on the API side through a configurable webhook, so newly stored pending invitations can now emit a structured payload with the invited email, project metadata, inviter details, and the full claim URL instead of relying only on manual copy/share
  - made invitation creation preserve the pending invite even when outbound delivery is disabled or fails, while returning explicit `delivered` / `disabled` / `failed` delivery outcomes so operators can act on the result without losing the invitation itself
  - added a dedicated pending-invitation redelivery route plus dashboard control, so operators can resend the current claim link on demand without mutating role metadata or recreating the invite
  - documented the new API env knobs for claim-link base URL and invitation delivery webhook auth, and verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/.env.example`
  - `apps/api/src/config/env-core.ts`
  - `apps/api/src/config/env-core.test.ts`
  - `apps/api/src/services/project-invitation-delivery.service.ts`
  - `apps/api/src/services/project-invitation-delivery.service.test.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `README.md`
  - `docs/progress.md`
- what is still missing:
  - the original four-phase MVP plan is now closed; any deeper email-provider integration, full team/workspace model, or broader platform maturity work should be captured in the next roadmap-driven plan rather than reopening the original phase checklist
- next recommended step:
  - treat the current four-phase plan as complete, then start a fresh post-phase planning pass against `docs/roadmap.md` when you want to choose the next deliberate expansion slice

### Phase: Phase 4 project ownership transfer follow-through (2026-03-26, final project-admin lifecycle seam)

- what was built:
  - added an explicit project-ownership transfer API path plus owner-only transfer guard so ownership can move to an existing member without widening that control to ordinary project-admin memberships
  - extended the project service/repository layer so ownership transfer promotes the new owner into an admin-capable membership, preserves the previous owner as an admin member, and then rehydrates the updated project member state from the canonical membership list
  - upgraded the dashboard project members panel with an owner-only "Make Owner" action plus clearer copy explaining that ownership transfer keeps the previous owner on the project as an admin until later removal
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/auth/auth-utils.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project membership now has a real owner-transfer path, but Phase 4 still has one open decision around whether lightweight outbound invitation delivery belongs in-scope or whether the current shareable claim-link model is enough to close the phase
- next recommended step:
  - make the Phase 4 closeout decision on outbound invitation delivery: either add a minimal delivery seam/workflow now, or explicitly treat the current claim-link invite model as sufficient and close Phase 4 before moving back to broader roadmap additions

### Phase: Phase 4 project invitation claim/history follow-through (2026-03-26, shareable claim links + preserved invitation lifecycle)

- what was built:
  - upgraded project invitations from disposable pending rows into a preserved lifecycle model with `pending` / `accepted` / `cancelled` states, claim tokens, and retained acceptance/cancellation timestamps so invitation history no longer disappears once an invite changes state
  - added unauthenticated invitation-claim lookup plus authenticated claim acceptance API routes, allowing shareable invitation URLs to resolve into project/role details and letting the invited persisted user accept access directly from that claim token
  - extended account-setup auto-accept to mark matching invitations as accepted instead of deleting them, so the system now keeps historical invitation truth while still onboarding invited users automatically by email
  - upgraded the dashboard with a dedicated `/invitations/[claimToken]` claim page, session-aware claim actions, pending-invite claim links on the project members page, and a new invitation history view for accepted/cancelled invites
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0009_project_invitation_lifecycle.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/invitations/[claimToken]/page.tsx`
  - `apps/dashboard/app/invitations/[claimToken]/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - invitations now have shareable claim primitives and preserved history, but there is still no real outbound email delivery, resend automation, ownership transfer flow, or broader workspace/team lifecycle above per-project membership
- next recommended step:
  - continue Phase 4 auth/user-model work by closing out the remaining membership-admin gap: decide and implement ownership-transfer / final project-admin lifecycle semantics on top of the new invitation history model, then revisit whether outbound delivery automation still belongs inside Phase 4 or a later maturity pass

### Phase: Phase 4 project invitation management follow-through (2026-03-26, pending invite refresh/cancel + clearer acceptance visibility)

- what was built:
  - extended the project-membership API with pending-invitation update and delete operations, so owners/admins/project-admins can now refresh or cancel stored invitations instead of treating pending emails as immutable rows
  - added repository, service, and route coverage for those pending-invite management paths, including explicit `404` handling when an invitation has already been claimed or removed
  - upgraded the dashboard project detail members panel so each pending invitation now has inline save/refresh and cancel actions, plus clearer copy explaining that account setup auto-accepts matching invites and that saving refreshes follow-up visibility
  - improved account-setup feedback so profile creation now names accepted projects and roles when pending invitations are claimed, and clarified the same auto-accept behavior in the account settings UI
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/settings/account/actions.ts`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - pending invitations are now storable, manageable, and auto-accepted during account setup, but there is still no real email delivery, deep-link/tokenized acceptance flow, accepted/cancelled invitation history, or ownership-transfer/workspace-team model yet
- next recommended step:
  - continue Phase 4 auth/user-model work by finishing the invitation lifecycle beyond dashboard-local management: add invitation delivery/claim primitives and clearer accepted/cancelled history, then decide whether ownership transfer belongs in that same final membership pass or immediately after it

### Phase: Phase 4 project invitation storage and acceptance follow-through (2026-03-26, pending invites + account-setup auto-accept)

- what was built:
  - added a persisted `project_invitations` model plus API support for listing pending invitations, so project membership no longer stops at already-persisted users and managers can see which email-based invites are still waiting to be claimed
  - changed project invite behavior so existing persisted users still become members immediately, while unknown emails now create pending invitations instead of erroring, with duplicate pending invites rejected cleanly
  - extended account setup so saving a new persisted profile automatically accepts any pending project invitations that match the saved email, then rehydrates the dashboard with a success message that reflects accepted invitations when relevant
  - updated the dashboard project detail members surface to show pending invitations alongside active members and clarified the direct-member-vs-pending-invite behavior in the invite flow
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/drizzle/0008_project_invitations.sql`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.service.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/settings/account/actions.ts`
  - `docs/progress.md`
- what is still missing:
  - pending invitations now exist and can be auto-accepted during account setup, but there is still no explicit invitation cancellation/resend path, no email delivery or deep-link acceptance workflow, and no richer ownership-transfer or workspace-level team model yet
- next recommended step:
  - continue Phase 4 auth/user-model work by adding invitation management follow-through around pending invites: cancellation/resend controls, clearer invite acceptance visibility for operators, and then decide whether ownership transfer belongs in the same team-admin slice or a later pass

### Phase: Phase 4 project membership lifecycle follow-through (2026-03-26, role updates + member removal)

- what was built:
  - expanded the new project-membership API with role updates and member removal for existing non-owner memberships, while keeping project-owner membership immutable so ownership does not get accidentally stripped before invitation acceptance and richer transfer rules exist
  - added route and service coverage for those new membership lifecycle operations, including explicit `404` handling for missing members and `409` handling when callers try to mutate the owner membership
  - upgraded the dashboard project detail members panel so operators with owner/admin/project-admin access can now change member roles inline or remove non-owner members without leaving the project page, while self-removal safely redirects back to the broader projects view
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project membership is now manageable for existing persisted users, but invitations still only work for users who already exist in the database, there is no stored invitation/acceptance or delivery lifecycle yet, and there is still no ownership-transfer or broader team/workspace model above per-project membership
- next recommended step:
  - continue Phase 4 auth/user-model work by introducing stored invitation records and acceptance flows so project membership can include users who have not completed account setup yet, then decide whether ownership transfer belongs in the same lifecycle pass or a later team-admin slice

### Phase: Phase 4 project membership groundwork (2026-03-26, owner seeding + member list/invite foundations)

- what was built:
  - updated project creation to seed an owner membership row and fixed project membership lookup semantics so later project-role checks operate on a correct per-project/per-user foundation instead of a permissive membership query
  - added authenticated API groundwork for project member listing and existing-user invites, including owner/admin/project-admin authorization rules and explicit conflict/not-found domain errors for duplicate membership and missing persisted users
  - extended the dashboard project detail page with a members panel, current member list, and an invite form for operators who already have the right project-management role, while keeping missing-profile actors on the account-setup path before they attempt membership writes
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/server/domain-errors.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/auth/auth-utils.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - project membership now has a real persistence and UI foothold, but invitations still only target already-persisted users, there is no invitation acceptance or delivery lifecycle yet, and owners/admins still cannot change roles or remove members through the product
- next recommended step:
  - continue Phase 4 auth/user-model work by expanding this into a fuller project-membership lifecycle, starting with role updates and member removal for existing memberships, then shaping stored invitation/acceptance flows for users who are not yet present in the database

### Phase: Phase 4 onboarding bridge follow-through (2026-03-26, sign-in and write-path guidance)

- what was built:
  - updated dashboard sign-in so accepted bootstrap-token sessions with no persisted user record now redirect into account setup instead of pretending the operator is already fully onboarded
  - taught `/settings/account`, session controls, and the Settings overview to surface missing-profile state more explicitly and preserve safe return targets so account setup can act as the bridge back to the page the operator was originally trying to reach
  - added missing-profile guards to token-management actions and project creation so write paths that require a persisted `users` row now route into account setup rather than falling through to broken bootstrap/dev-auth behavior
  - refreshed dashboard auth/setup guidance in the sign-in page and README so bootstrap/dev paths are described as transitional setup tools rather than normal long-term operator identity
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/lib/dashboard-auth-navigation.ts`
  - `apps/dashboard/app/sign-in/actions.ts`
  - `apps/dashboard/app/sign-in/page.tsx`
  - `apps/dashboard/app/settings/account/actions.ts`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `apps/dashboard/app/settings/page.tsx`
  - `apps/dashboard/components/dashboard-session-controls.tsx`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/tokens/actions.ts`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - the onboarding bridge now works much more intentionally, but the platform still lacks the first real membership/invitation workflow and still has some broader bootstrap/dev-auth assumptions to reduce outside the immediate sign-in and write-path guidance
- next recommended step:
  - continue Phase 4 auth/user-model work by starting the first persisted membership/invitation groundwork from the now-stored user model, while cleaning up any remaining bootstrap/dev-auth assumptions that still read as normal operator state

### Phase: Phase 4 persisted-user bootstrap onboarding (2026-03-26, first real user-profile workflow)

- what was built:
  - added an authenticated API profile upsert route at `/v1/auth/me/profile`, backed by auth-service persistence logic that can create or refresh the current actor's `users` record while mapping duplicate-email conflicts cleanly
  - added the first real dashboard account-onboarding form on `/settings/account`, so viewers without a persisted profile can create one in place and existing users can keep their stored name/email current
  - updated Settings and token management to treat persisted profile setup as a first-class prerequisite for DB-backed token workflows instead of assuming every authenticated actor already has a stored user row
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/auth/auth.routes.ts`
  - `apps/api/src/modules/auth/auth.routes.test.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.service.test.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/app/settings/account/actions.ts`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `apps/dashboard/app/settings/page.tsx`
  - `apps/dashboard/components/token-management-page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform now has a real persisted-user bootstrap loop, but several operator-facing flows still assume bootstrap/dev-auth as acceptable long-term identity paths, and there is still no richer membership/invitation model beyond single-user token ownership
- next recommended step:
  - continue Phase 4 auth/user-model work by carrying this onboarding path through the remaining bootstrap/dev-auth surfaces, especially sign-in and settings guidance, then begin the first membership/invitation groundwork from the now-persisted user model

### Phase: Phase 4 deployment-detail auth recovery and action redirect follow-through (2026-03-26, remaining auth-aware route and action cleanup)

- what was built:
  - removed the old deployment-detail fallback redirect so direct deployment URLs now show an explicit sign-in / re-auth state when live access is unavailable instead of bouncing operators back to the deployments index
  - added a shared action-side auth redirect helper and wired project creation plus token create/rotate/revoke actions through it so missing or expired viewer context now routes through sign-in recovery rather than generic `no user context` redirects
  - refreshed the remaining dashboard copy that still over-emphasized `API_AUTH_TOKEN`, including the projects action feedback path, auth transport description, and dashboard README guidance, so per-user session cookies read as the normal operator path and the env token is clearly documented as fallback-only
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/lib/dashboard-action-auth.ts`
  - `apps/dashboard/app/deployments/[id]/page.tsx`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/tokens/actions.ts`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/lib/viewer-auth.ts`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - the dashboard auth/session experience is now largely coherent, but the broader Phase 4 auth/user-model work still stops at token-backed identity and dashboard session recovery; there is still no first-class persisted user bootstrap/onboarding flow or richer team/membership model beyond token ownership and dev-auth/bootstrap paths
- next recommended step:
  - continue Phase 4 auth/user-model work by starting the first real persisted-user workflow beyond token-only identity, beginning with a concrete bootstrap/onboarding slice that reduces the remaining dev/bootstrap-token assumptions in operator-facing flows while preparing for later team membership and invitation work

### Phase: Phase 4 project-scoped auth gating and session-aware proxy follow-through (2026-03-26, remaining live page auth recovery)

- what was built:
  - added a shared dashboard unavailable-state wrapper that chooses between explicit sign-in / re-auth guidance and true outage messaging from the same request-auth context
  - applied that auth-aware unavailable handling across the remaining project-scoped pages, plus the global environment, logs, settings, account, and token-management views, so those routes no longer collapse missing or expired auth into a generic live-data outage
  - updated live log streaming to offer a direct sign-in-again recovery path from the current page and updated the log proxy routes to describe session expiry, access denial, and server-fallback rejection more explicitly
  - tightened several dashboard auth and action error messages so `API_AUTH_TOKEN` is framed as a temporary fallback rather than the normal operator workflow
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/components/dashboard-unavailable-state.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/projects/[id]/deployments/page.tsx`
  - `apps/dashboard/app/projects/[id]/environment/page.tsx`
  - `apps/dashboard/app/projects/[id]/logs/page.tsx`
  - `apps/dashboard/app/environment/page.tsx`
  - `apps/dashboard/app/logs/page.tsx`
  - `apps/dashboard/app/settings/page.tsx`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `apps/dashboard/components/token-management-page.tsx`
  - `apps/dashboard/components/logs-live-stream.tsx`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/tokens/actions.ts`
  - `apps/dashboard/lib/helpers.ts`
  - `docs/progress.md`
- what is still missing:
  - the dashboard now handles auth-required and expired-session states much more consistently, but the direct deployment-detail route still falls back through a top-level redirect instead of exposing its own auth-aware unavailable state, and several server actions still redirect with coarse `no user context` style failures instead of explicit re-auth guidance
- next recommended step:
  - continue Phase 4 auth/user-model work by making direct deployment-detail access and the remaining server-action redirects auth-aware, then finish scrubbing the last env-token-first messaging and docs so per-user sessions read as the default operator workflow

### Phase: Phase 4 dashboard auth gating and re-auth recovery (2026-03-26, top-level session-aware live pages)

- what was built:
  - taught the shared dashboard loader to distinguish auth-required states from genuine live-data outages so top-level pages can stop treating missing or expired auth like generic API failure
  - added a reusable auth-required empty state with explicit sign-in and session-clear actions, then applied it to the top-level Projects, Deployments, and Operational Status routes instead of silently dropping into old demo/mock-mode when auth is missing
  - updated the dashboard sign-in flow to preserve a safe in-app return target so sign-in and re-auth can send operators back to the page they were trying to access
  - surfaced expired-session state in the global dashboard session controls so rejected session cookies are visible and easy to recover from
  - kept the older sample-data fallback only for genuine live-data outage mode, so auth problems and upstream outages are now presented differently
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/helpers.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/lib/dashboard-auth-navigation.ts`
  - `apps/dashboard/components/dashboard-auth-required-state.tsx`
  - `apps/dashboard/components/dashboard-session-controls.tsx`
  - `apps/dashboard/app/sign-in/actions.ts`
  - `apps/dashboard/app/sign-in/page.tsx`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/app/deployments/page.tsx`
  - `apps/dashboard/app/status/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the top-level dashboard is now session-aware, but the same explicit auth-required / re-auth behavior is not yet applied consistently across every project-scoped live page, proxy flow, and token/env management edge case, and the broader user/team membership model is still token-centric
- next recommended step:
  - continue Phase 4 auth/user-model work by carrying the same explicit sign-in gating and return-to-page re-auth behavior through the remaining project-scoped pages and log/environment/token proxy paths, then reduce the remaining places that still frame `API_AUTH_TOKEN` as the normal operator path

### Phase: Phase 4 interactive dashboard session flow (2026-03-26, per-user sign-in and sign-out)

- what was built:
  - added a dashboard-side session helper that stores a per-user API token in an httpOnly cookie and resolves request auth transport from session cookie, server env bearer fallback, optional dev-auth header hint, or an unconfigured state
  - updated the dashboard API client and proxy routes so server-side API calls now prefer the signed-in session cookie over `API_AUTH_TOKEN`, while preserving the env token as a fallback when no browser session exists
  - added a dedicated `/sign-in` route plus server actions for sign-in and sign-out, validating submitted tokens through `/v1/auth/me` before establishing the dashboard session
  - added global session controls in the dashboard shell so operators can see whether the request is using a session cookie, env fallback, or dev auth, and can sign in or sign out without digging through settings
  - updated the settings and token-management surfaces to point missing-auth flows toward sign-in and to distinguish between a true per-user session and the older env-token fallback path
  - refreshed dashboard auth messaging so unauthorized or missing-auth states now reference the active dashboard session path instead of assuming `API_AUTH_TOKEN` is the only live auth option
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/lib/dashboard-session.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/viewer-auth.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/lib/helpers.ts`
  - `apps/dashboard/app/sign-in/actions.ts`
  - `apps/dashboard/app/sign-in/page.tsx`
  - `apps/dashboard/components/dashboard-session-controls.tsx`
  - `apps/dashboard/app/layout.tsx`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/app/settings/page.tsx`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `apps/dashboard/components/token-management-page.tsx`
  - `apps/dashboard/app/tokens/actions.ts`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/components/logs-live-stream.tsx`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - the dashboard now has the first real per-user session workflow, but unauthenticated top-level pages can still fall back into older demo/mock-mode patterns instead of consistently steering operators into the live sign-in path, and there is still no richer user/team membership workflow beyond token-backed identity
- next recommended step:
  - continue Phase 4 by making the live dashboard experience fully session-aware: replace the remaining auth-missing mock/demo fallbacks with explicit sign-in gating or sign-in CTAs on live pages, then add better expired-session and re-auth handling so unauthorized states recover cleanly without forcing env-token fallbacks

### Phase: Phase 4 account/session surface follow-through (2026-03-26, API-backed auth source and viewer profile visibility)

- what was built:
  - added an API-side auth service behind `/v1/auth/me` so the authenticated viewer payload now includes the auth source (`database-token`, `bootstrap-token`, `dev-user-header`, or `dev-admin-token`), derived auth mode, and persisted user profile details when a matching user record exists
  - extended the API auth context to preserve source metadata across DB-backed tokens, bootstrap tokens, and explicit local dev-auth paths so account/session state no longer has to be guessed purely from dashboard environment variables
  - added a dedicated `/settings/account` dashboard surface plus settings navigation/sidebar entries to show the resolved actor, stored name/email when present, effective scopes, live session source, and current dashboard request transport
  - simplified the main Settings overview into launcher-style cards for account/session and token management so the detailed auth/session state now has a first-class home instead of living only as overview diagnostics
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/src/plugins/auth-context.test.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.service.test.ts`
  - `apps/api/src/modules/auth/auth.routes.ts`
  - `apps/api/src/modules/auth/auth.routes.test.ts`
  - `apps/api/src/modules/auth/auth-utils.ts`
  - `apps/api/src/modules/auth/auth-utils.test.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/api-routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/viewer-auth.ts`
  - `apps/dashboard/app/settings/page.tsx`
  - `apps/dashboard/app/settings/account/page.tsx`
  - `apps/dashboard/components/settings-subnav.tsx`
  - `apps/dashboard/components/sidebar.tsx`
  - `docs/progress.md`
- what is still missing:
  - the product now has a real account/session visibility surface, but it still lacks an interactive sign-in/sign-out flow, per-user dashboard sessions, and broader team/invitation workflows beyond token-backed actor resolution
- next recommended step:
  - continue Phase 4 by introducing the first interactive dashboard auth workflow: let operators sign in with a DB-backed API token into a per-user server-side session/cookie, resolve viewer context from that session instead of a shared server env token, and add explicit sign-out/session lifecycle UI

### Phase: Phase 4 settings auth visibility follow-through (2026-03-26, current actor and auth-source diagnostics)

- what was built:
  - updated the dashboard Settings overview to resolve the authenticated viewer through the existing viewer-context path and surface the current actor's user id, role, and effective scopes directly in the UI
  - added explicit auth diagnostics to the Settings overview so operators can see whether dashboard API calls are currently using bearer-token auth, local dev-auth header hints, or an unconfigured auth path
  - exposed the active API base URL, viewer endpoint, and optional dev-auth user hint in the Settings overview so the viewer-context behavior is inspectable without reading environment variables or source code
  - updated the settings token card copy so it now reflects viewer-scoped token management instead of the older implicit demo-user model
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/app/settings/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the dashboard now exposes the resolved viewer and auth path in Settings, but the product still lacks a broader in-UI account/session surface and any first-class team membership or invitation workflows beyond token-backed actor resolution
- next recommended step:
  - continue Phase 4 by promoting the resolved viewer context into a dedicated account/session surface beyond the Settings overview, then begin the first real user/session workflow slice so login and account state stop being inferred purely from token-backed diagnostics

### Phase: Phase 4 authenticated dashboard viewer-context follow-through (2026-03-26, API-backed current actor resolution)

- what was built:
  - added an authenticated `/v1/auth/me` API route so the platform can expose the current actor's user id, role, and scopes without requiring a user-id path parameter just to discover who the caller is
  - added dashboard-side viewer-context resolution helpers so pages and server actions can resolve the current authenticated actor first and then target the right user-scoped project/token APIs from that live context
  - rewired dashboard project loading, project detail pages, global environment/log views, and token management flows to use the resolved viewer context instead of hard-gating on `NEXT_PUBLIC_DEMO_USER_ID`
  - kept `NEXT_PUBLIC_DEMO_USER_ID` as an optional local dev-auth header hint rather than the dashboard's primary identity source, and aligned log proxy routes with the shared dashboard auth-header builder so proxy auth matches the rest of the dashboard
  - updated dashboard messaging and README guidance to reflect the new viewer-context-first auth model
  - verified the slice with `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/api/src/modules/auth/auth.routes.ts`
  - `apps/api/src/modules/auth/auth.routes.test.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/helpers.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/app/projects/actions.ts`
  - `apps/dashboard/app/tokens/actions.ts`
  - `apps/dashboard/components/token-management-page.tsx`
  - `apps/dashboard/app/environment/page.tsx`
  - `apps/dashboard/app/logs/page.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/app/projects/[id]/environment/page.tsx`
  - `apps/dashboard/app/projects/[id]/deployments/page.tsx`
  - `apps/dashboard/app/projects/[id]/logs/page.tsx`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/app/api/log-stream/route.ts`
  - `apps/dashboard/app/api/log-export/route.ts`
  - `apps/dashboard/README.md`
  - `docs/progress.md`
- what is still missing:
  - the dashboard can now resolve and act as the authenticated viewer without a hardcoded demo-user identity, but the product still lacks a first-class in-UI account/session surface and broader team/session workflows beyond token-backed actor resolution
- next recommended step:
  - continue Phase 4 by surfacing the current authenticated actor in the Settings overview with role/scope visibility and clearer auth-source diagnostics, then use that foundation to shape the next login/session and team-permission steps without reintroducing hidden identity assumptions

### Phase: Phase 4 project-composition service status follow-through (2026-03-26, composed per-service dashboard visibility)

- what was built:
  - added a dedicated dashboard-side project service-status composition helper so multi-service project state is derived per service instead of collapsing to whichever deployment happened most recently
  - updated project list loading to derive composed project health labels such as `healthy`, `deploying`, `degraded`, and `partial` from the latest deployment recorded for each service rather than the single latest deployment in the project
  - updated the projects list cards to show a compact service-status summary line so multi-service projects expose a per-service state breakdown directly from the overview page
  - updated the project detail page to show a composed service-status summary card plus per-service status badges, latest deployment timing, latest deployment links, and public runtime URLs when available
  - verified the slice with `npm --workspace @vcloudrunner/dashboard run typecheck` and `npm --workspace @vcloudrunner/dashboard run lint`
- files created or changed:
  - `apps/dashboard/lib/project-service-status.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/components/project-card.tsx`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/lib/mock-data.ts`
  - `docs/progress.md`
- what is still missing:
  - project health is now composed from service deployment state, but the dashboard still depends on the demo-user bootstrap path and service visibility is still deployment-derived rather than driven by first-class health checks or broader auth-aware operator workflows
- next recommended step:
  - continue Phase 4 by starting the broader auth/user-model evolution, beginning with reducing the dashboard's `NEXT_PUBLIC_DEMO_USER_ID` coupling in favor of first-class authenticated user context and project access flows before layering on larger team/session UX

### Phase: Phase 4 project-composition service discovery follow-through (2026-03-26, generated service env + internal service addressing)

- what was built:
  - added shared service-discovery helpers so project services now resolve to stable, Docker-safe internal hostnames and consistent env-token naming across the API, worker, and dashboard
  - added API-side generated `VCLOUDRUNNER_SERVICE_*` discovery env output for the selected deployment service and every configured project service, including service name, kind, exposure, source root, host, port, and combined address values
  - merged those generated discovery vars into queued deployment payload env so services receive a consistent reserved platform-level service map without relying on manually curated project env entries
  - updated the worker runtime path to attach the selected service's generated internal hostname as a Docker network alias so cross-service communication can use the same hostname surfaced through the generated env contract
  - surfaced each generated internal host on the dashboard project detail page so the internal addressing convention is visible alongside service role, exposure, and source-root metadata
  - verified the slice with `npm --workspace @vcloudrunner/shared-types run build`, `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, `npm --workspace @vcloudrunner/worker run typecheck`, and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `packages/shared-types/src/index.ts`
  - `apps/api/src/modules/deployments/service-discovery-env.ts`
  - `apps/api/src/modules/deployments/service-discovery-env.test.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/worker/src/services/runtime/container-runtime-manager.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.test.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/services/deployment-runner.test.ts`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - services can now discover each other through stable generated env and internal hostnames, but the platform still collapses project operational state to deployment-centric views instead of showing a composed per-service health and status picture
- next recommended step:
  - continue the project-composition model by surfacing composed per-service health/status in the dashboard and project-level loaders so internal services become operationally first-class in day-to-day visibility, not just deploy targeting and runtime wiring

### Phase: Phase 4 project-composition service targeting follow-through (2026-03-26, named-service deploy selection + service-scoped active concurrency)

- what was built:
  - made the selected deployment service first-class on deployment records instead of metadata-only by adding a persisted `service_name` field plus a migration that backfills existing rows from stored service metadata or the default `app` service
  - replaced the project-wide single-active deployment invariant with a per-project/per-service active-deployment invariant so different services in the same project can now queue/build/run independently while still preventing overlapping deployments of the same service
  - updated deployment creation to persist the resolved service name alongside service metadata and to return service-specific conflict errors when a target service already has queued/building/running work
  - surfaced the selected service through dashboard deployment list/detail/project-history views so targeted service deploys are visible without relying purely on metadata inference
  - verified the slice with `npm --workspace @vcloudrunner/shared-types run build`, `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, `npm --workspace @vcloudrunner/worker run typecheck`, and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/api/drizzle/0007_deployment_service_name.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/deployments/deployments.repository.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/api/src/server/domain-errors.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/components/deployment-table.tsx`
  - `apps/dashboard/app/deployments/page.tsx`
  - `apps/dashboard/app/deployments/[id]/page.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `apps/dashboard/lib/mock-data.ts`
  - `docs/progress.md`
- what is still missing:
  - multi-service projects can now target and deploy services independently, but service-to-service wiring is still manual through project-level env vars and project-level health/status views still lean on the latest deployment rather than a composed per-service picture
- next recommended step:
  - continue the project-composition model by defining service-to-service internal addressing and service-aware env conventions, then surface composed per-service health/status in the dashboard so internal services become operationally first-class instead of just independently deployable

### Phase: Phase 4 project-composition runtime follow-through (2026-03-26, `serviceSourceRoot`-aware worker build path)

- what was built:
  - threaded the selected project-service `serviceSourceRoot` through worker workspace preparation, image-build orchestration, and runtime execution so deployments no longer assume the repository root is the only build target
  - added worker-side normalization and validation for service source roots so malformed or escaping paths fail as deployment-configuration errors instead of silently escaping the prepared workspace
  - updated Dockerfile detection and Docker build command composition to scope candidate search, fallback tree scans, and Docker build context to the selected service subtree rather than the whole repository
  - updated the prepared workspace contract to return the selected service path inside the cloned repository so runtime execution metadata reflects the actual deployed service root
  - verified the slice with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/src/services/deployment-source-root.ts`
  - `apps/worker/src/services/deployment-source-root.test.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/services/deployment-runner.test.ts`
  - `apps/worker/src/services/build-detection/build-system-detector.ts`
  - `apps/worker/src/services/build-detection/build-system-resolver.ts`
  - `apps/worker/src/services/build-detection/configured-build-system-resolver.ts`
  - `apps/worker/src/services/build-detection/configured-build-system-resolver.test.ts`
  - `apps/worker/src/services/build-detection/dockerfile-detector.ts`
  - `apps/worker/src/services/build-detection/dockerfile-detector.test.ts`
  - `apps/worker/src/services/runtime/deployment-workspace-manager.ts`
  - `apps/worker/src/services/runtime/local-deployment-workspace-manager.ts`
  - `apps/worker/src/services/runtime/local-deployment-workspace-manager.test.ts`
  - `apps/worker/src/services/runtime/deployment-image-builder.ts`
  - `apps/worker/src/services/runtime/configured-deployment-image-builder.ts`
  - `apps/worker/src/services/runtime/configured-deployment-image-builder.test.ts`
  - `apps/worker/src/services/runtime/deployment-command-runner.ts`
  - `apps/worker/src/services/runtime/shell-deployment-command-runner.ts`
  - `apps/worker/src/services/runtime/shell-deployment-command-runner.test.ts`
  - `docs/progress.md`
- what is still missing:
  - deployments still always resolve to the primary public service, so service kind/exposure semantics and internal-service orchestration remain metadata rather than executable runtime behavior
- next recommended step:
  - continue the project-composition model by letting deployments target a named project service and by carrying `serviceKind` / `serviceExposure` into ingress and runtime decisions so internal services stop assuming public web behavior

### Phase: Phase 4 project-composition groundwork (2026-03-26, project service-definition contract)

- what was built:
  - added an explicit project `services` contract in shared types and API persistence with a safe default single-service shape so existing projects still resolve to one public `app` service rooted at `.`
  - added API validation and normalization for multi-service project definitions, including unique service names, exactly one public service, and repo-relative `sourceRoot` validation
  - updated deployment creation to resolve the primary public service from the project contract, merge its runtime defaults into deployment runtime selection, and include the chosen service metadata in the queued job payload
  - updated the dashboard project list and project detail views to surface service counts, the primary public service, and each configured service's role, exposure, source root, and runtime defaults
  - verified the slice with `npm --workspace @vcloudrunner/shared-types run build`, `npm --workspace @vcloudrunner/api run typecheck`, `npm --workspace @vcloudrunner/api test`, `npm --workspace @vcloudrunner/dashboard run typecheck`, `npm --workspace @vcloudrunner/worker run typecheck`, and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `packages/shared-types/src/index.ts`
  - `apps/api/drizzle/0006_project_services.sql`
  - `apps/api/drizzle/meta/_journal.json`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.service.ts`
  - `apps/api/src/modules/projects/projects.service.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/api/src/modules/deployments/deployments.routes.test.ts`
  - `apps/api/src/modules/environment/environment.routes.test.ts`
  - `apps/api/src/modules/logs/logs.routes.test.ts`
  - `apps/dashboard/lib/api.ts`
  - `apps/dashboard/lib/loaders.ts`
  - `apps/dashboard/lib/mock-data.ts`
  - `apps/dashboard/components/project-card.tsx`
  - `apps/dashboard/components/project-create-form.tsx`
  - `apps/dashboard/components/project-create-panel.tsx`
  - `apps/dashboard/app/projects/page.tsx`
  - `apps/dashboard/app/projects/[id]/page.tsx`
  - `docs/progress.md`
- what is still missing:
  - the platform can now describe multi-service projects, but the worker/runtime path still largely assumes a root-level single build target once a deployment starts executing
- next recommended step:
  - continue the project-composition model by making build detection, workspace preparation, and runtime execution honor `serviceSourceRoot` from the selected project service so non-root services can actually deploy

### Phase: Phase 4 worker simple-adapter composition closeout (2026-03-26, configured HTTP/ingress/archive seams)

- what was built:
  - extracted dedicated configured factories for the worker outbound HTTP client, Caddy service, webhook deployment-event listener, ingress manager, deployment-log archive builder, and deployment-log archive store so those remaining simple adapters no longer instantiate their concrete defaults inline at the surrounding service boundaries
  - rewired the existing top-level factories for those services to delegate through the new configured seams while preserving straightforward override hooks for focused tests
  - added an explicit HTTP archive upload provider factory and rewired the archive upload provider registry to compose every provider through adapter-specific factories instead of constructing the HTTP provider inline
  - added focused coverage for the new configured factory seams and re-verified the worker package with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/src/services/http/configured-outbound-http-client.factory.ts`
  - `apps/worker/src/services/http/configured-outbound-http-client.factory.test.ts`
  - `apps/worker/src/services/http/outbound-http-client.factory.ts`
  - `apps/worker/src/services/configured-caddy.service.factory.ts`
  - `apps/worker/src/services/configured-caddy.service.factory.test.ts`
  - `apps/worker/src/services/caddy.service.factory.ts`
  - `apps/worker/src/services/configured-webhook-deployment-event-listener.factory.ts`
  - `apps/worker/src/services/configured-webhook-deployment-event-listener.factory.test.ts`
  - `apps/worker/src/services/webhook-deployment-event-listener.factory.ts`
  - `apps/worker/src/services/ingress/configured-ingress-manager.factory.ts`
  - `apps/worker/src/services/ingress/configured-ingress-manager.factory.test.ts`
  - `apps/worker/src/services/ingress/ingress-manager.factory.ts`
  - `apps/worker/src/services/archive-build/configured-deployment-log-archive-builder.factory.ts`
  - `apps/worker/src/services/archive-build/configured-deployment-log-archive-builder.factory.test.ts`
  - `apps/worker/src/services/archive-build/deployment-log-archive-builder.factory.ts`
  - `apps/worker/src/services/archive-store/configured-deployment-log-archive-store.factory.ts`
  - `apps/worker/src/services/archive-store/configured-deployment-log-archive-store.factory.test.ts`
  - `apps/worker/src/services/archive-store/deployment-log-archive-store.factory.ts`
  - `apps/worker/src/services/archive-upload/http-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/http-archive-upload-provider.factory.test.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.registry.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker service graph is now much more uniformly factory-driven, so the next meaningful extensibility work should shift from small composition cleanup to the first multi-service project-composition slice
- next recommended step:
  - begin the first project-composition model slice by introducing multi-service project definitions and shared service-level env/runtime wiring for one public service plus internal-only services

### Phase: Phase 4 worker queue/connection composition follow-through (2026-03-26, BullMQ Redis connection factory seam)

- what was built:
  - removed the remaining module-level BullMQ Redis connection default from the worker path so queue connection parsing/composition is no longer hard-wired in the shared `redis.ts` module
  - added dedicated configured and override-friendly Redis connection factories so production wiring can resolve `env.REDIS_URL` through a proper seam while tests and adjacent composition can still inject explicit URLs or connections
  - updated `createDeploymentWorker()` to delegate its default connection through the new factory seam while preserving explicit connection overrides for focused tests
  - added focused coverage around configured/default Redis connection creation plus deployment-worker default wiring and verified the worker package with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/src/queue/redis.ts`
  - `apps/worker/src/queue/configured-redis-connection.factory.ts`
  - `apps/worker/src/queue/configured-redis-connection.factory.test.ts`
  - `apps/worker/src/queue/redis-connection.factory.ts`
  - `apps/worker/src/queue/redis-connection.factory.test.ts`
  - `apps/worker/src/workers/deployment.worker.factory.ts`
  - `apps/worker/src/workers/deployment.worker.factory.test.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker queue/bootstrap graph is now consistently factory-driven, but Phase 4 still needs a final closeout pass to confirm the remaining composition edges are clean before shifting focus to the project-composition model
- next recommended step:
  - finish the Phase 4 closeout audit around remaining composition seams, then begin the first project-composition model slice so one project can describe multiple named services

### Phase: Phase 4 worker infrastructure adapter factory follow-through (2026-03-26, heartbeat Redis + simple configured adapters)

- what was built:
  - extracted heartbeat Redis construction out of `background-scheduler.factory.ts` into a dedicated `createHeartbeatRedis()` seam and added a configured background-scheduler factory so scheduler composition no longer directly instantiates Redis inline
  - added dedicated configured factories for the repository file inspector, deployment-state queryable, and Docker client so those remaining simple infrastructure adapters now follow the same top-level-factory plus configured-factory pattern as the rest of the worker graph
  - updated the top-level scheduler, repository-inspector, deployment-state-queryable, and Docker-client factories to delegate default production composition through those new configured seams while preserving explicit override hooks for focused tests
  - refreshed factory coverage around heartbeat Redis wiring plus the new configured scheduler/queryable/repository-inspector/Docker-client seams
  - verified the worker package with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/src/services/heartbeat-redis.factory.ts`
  - `apps/worker/src/services/heartbeat-redis.factory.test.ts`
  - `apps/worker/src/services/configured-background-scheduler.factory.ts`
  - `apps/worker/src/services/configured-background-scheduler.factory.test.ts`
  - `apps/worker/src/services/background-scheduler.factory.ts`
  - `apps/worker/src/services/background-scheduler.factory.test.ts`
  - `apps/worker/src/services/build-detection/configured-repository-file-inspector.factory.ts`
  - `apps/worker/src/services/build-detection/configured-repository-file-inspector.factory.test.ts`
  - `apps/worker/src/services/build-detection/repository-file-inspector.factory.ts`
  - `apps/worker/src/services/configured-deployment-state-queryable.factory.ts`
  - `apps/worker/src/services/configured-deployment-state-queryable.factory.test.ts`
  - `apps/worker/src/services/deployment-state-queryable.factory.ts`
  - `apps/worker/src/services/runtime/configured-docker-client.factory.ts`
  - `apps/worker/src/services/runtime/configured-docker-client.factory.test.ts`
  - `apps/worker/src/services/runtime/docker-client.factory.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker factory graph is much more consistently configured now, but the queue/worker path still has a small amount of default BullMQ/Redis connection wiring left to push behind the same style of seam before Phase 4 closeout feels complete
- next recommended step:
  - continue Phase 4 by extracting the default BullMQ/Redis connection wiring out of the deployment-worker path so queue/worker construction is as factory-driven as the rest of the worker bootstrap graph

### Phase: Phase 4 worker state-service composition follow-through (2026-03-26, configured deployment state service factory)

- what was built:
  - removed the remaining default collaborator composition from `DeploymentStateService`, so the class now accepts fully resolved dependencies instead of self-composing its own repository/ingress/archive defaults
  - added a dedicated `createConfiguredDeploymentStateService()` seam so default worker state-service wiring now lives in a proper configured factory alongside the rest of the Phase 4 worker composition graph
  - updated the top-level `createDeploymentStateService()` factory to preserve ergonomic override-based construction for tests and adjacent worker wiring while delegating default production composition through the new configured seam
  - refreshed the deployment-state service, archive auth/upload, and factory test suites so they build the service through explicit dependency options instead of relying on constructor-owned default wiring
  - verified the worker package with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/src/services/configured-deployment-state.service.factory.ts`
  - `apps/worker/src/services/configured-deployment-state.service.factory.test.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.factory.ts`
  - `apps/worker/src/services/deployment-state.service.factory.test.ts`
  - `apps/worker/src/services/deployment-state-service-dependencies.factory.ts`
  - `apps/worker/src/services/deployment-state.archive-auth.test.ts`
  - `apps/worker/src/services/deployment-state.archive-upload.integration.test.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `docs/progress.md`
- what is still missing:
  - the state-service path is now aligned with the rest of the worker composition model, but a few infrastructure-oriented worker factories still directly instantiate their concrete adapters
- next recommended step:
  - continue Phase 4 by extracting the remaining direct infrastructure adapter construction from worker factories, starting with the heartbeat Redis wiring in `background-scheduler.factory.ts` and the last simple concrete adapter seams

### Phase: Phase 4 worker archive provider-native integration follow-through (2026-03-25, SDK-backed S3/Azure + Google Auth GCS)

- what was built:
  - replaced the manual SigV4 S3 upload path with an AWS SDK-backed archive upload client behind a dedicated provider/client factory seam
  - replaced the manual Azure SharedKey signing path with an Azure Blob SDK-backed archive upload client behind a dedicated provider/client factory seam
  - replaced the hand-rolled GCS service-account JWT/token exchange path with a `google-auth-library`-backed access-token resolver while preserving the existing static-token fallback
  - expanded the archive upload request/uploader contract so provider-specific adapters can choose HTTP or native SDK transports behind the same configured archive upload seam
  - refreshed unit and integration coverage around configured archive upload delegation, GCS auth resolution, provider factories, and end-to-end archive upload behavior for S3/GCS/Azure
  - verified the worker package with `npm --workspace @vcloudrunner/worker run typecheck` and `npm --workspace @vcloudrunner/worker test`
- files created or changed:
  - `apps/worker/package.json`
  - `package-lock.json`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.registry.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.test.ts`
  - `apps/worker/src/services/archive-upload/deployment-log-archive-uploader.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.test.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-client.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-client.factory.ts`
  - `apps/worker/src/services/archive-upload/aws-sdk-s3-archive-upload-client.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-provider.factory.test.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-client.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-client.factory.ts`
  - `apps/worker/src/services/archive-upload/azure-blob-archive-upload-client.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-provider.factory.test.ts`
  - `apps/worker/src/services/archive-upload/gcs-access-token-resolver.ts`
  - `apps/worker/src/services/archive-upload/gcs-access-token-resolver.factory.ts`
  - `apps/worker/src/services/archive-upload/gcs-access-token-resolver.factory.test.ts`
  - `apps/worker/src/services/archive-upload/google-auth-gcs-access-token-resolver.ts`
  - `apps/worker/src/services/archive-upload/google-auth-gcs-access-token-resolver.test.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.archive-auth.test.ts`
  - `apps/worker/src/services/deployment-state.archive-upload.integration.test.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/src/services/deployment-state-service-dependencies.factory.test.ts`
  - `docs/progress.md`
- what is still missing:
  - archive upload providers are now on stable provider-native SDK/auth seams, but the worker still has a few remaining constructor/default-composition paths to finish before Phase 4 can be considered complete
- next recommended step:
  - continue Phase 4 by pulling the remaining default collaborator composition out of `DeploymentStateService` and adjacent worker service constructors so the runtime/state path is consistently factory-driven

### Phase: Phase 4 API service composition (2026-03-22)

- what was built:
  - extracted module-level `db` pool instantiation into a dedicated `createDbClient()` factory
  - extracted API setup out of `index.ts` into a dedicated `api-lifecycle.factory.ts`
  - extracted module-level service singletons from `api-tokens`, `deployments`, `environment`, `logs`, and `projects` routes
  - updated all API route plugins to accept their dependencies (services, database clients) as arguments
  - updated `build-server.ts` to instantiate and inject these dependencies, achieving a clean factory-driven architecture
  - updated API test suites to inject mock database clients and queue dependencies, removing the hardcoded global singletons
- files created or changed:
  - `apps/api/src/db/client.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/server/api-lifecycle.factory.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/build-server.test.ts`
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.ts`
  - `apps/api/src/modules/deployments/deployments.routes.test.ts`
  - `apps/api/src/modules/environment/environment.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.ts`
  - `apps/api/src/modules/logs/logs.routes.test.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/plugins/auth-context.test.ts`
  - `apps/api/src/modules/auth/auth-utils.test.ts`
  - `docs/progress.md`
- what is still missing:
  - Phase 4 dependency injection patterns are now established in `apps/api` routing, but further decoupling of services to pure abstractions remains for later phases.
- next recommended step:
  - continue Phase 4 by removing remaining implicit global singletons across the platform


### Phase: Phase 4 worker transport/event composition follow-through (2026-03-22, deployment event bus)

- what was built:
  - extracted webhook delivery out of `deployment-events.ts` into a dedicated `WebhookDeploymentEventListener` class with explicit dependencies (outbound HTTP, logger, config)
  - replaced the module-level auto-subscribed event bus with a pure `DeploymentEventBus` implementation
  - added dedicated factories to compose the webhook listener and attach it to the event bus, so the worker event sink no longer depends on inline module-level instantiation
  - updated unit tests to inject listener seams directly, allowing webhook logic and pure event bus emission to be tested in isolation
- files created or changed:
  - `apps/worker/src/services/webhook-deployment-event-listener.ts`
  - `apps/worker/src/services/webhook-deployment-event-listener.factory.ts`
  - `apps/worker/src/services/webhook-deployment-event-listener.test.ts`
  - `apps/worker/src/services/deployment-event-bus.factory.ts`
  - `apps/worker/src/services/deployment-event-bus.factory.test.ts`
  - `apps/worker/src/services/deployment-events.ts`
  - `apps/worker/src/services/deployment-events.test.ts`
  - `apps/worker/src/services/deployment-event-sink.factory.ts`
  - `apps/worker/src/services/deployment-event-sink.factory.test.ts`
  - `docs/progress.md`
- what is still missing:
  - the core event bus is much cleaner, but additional listeners or alternate transport backends (e.g., streaming logs over events) are future work
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from service constructors or module-level singleton wiring so composition continues moving outward toward dedicated configured factories

### Phase: Phase 4 worker bootstrap composition follow-through (2026-03-22, configured lifecycle factory)

- what was built:
  - extracted a dedicated configured worker-lifecycle factory so the worker bootstrap graph is no longer hand-wired inline in `index.ts`
  - moved default state-service, runtime-inspector, and background-scheduler composition behind that new seam while preserving the existing ready/completed/failed/shutdown lifecycle behavior
  - added focused coverage that proves the configured factory wires scheduler startup, heartbeat publishing, reconciliation, and runtime inspection together correctly
- files created or changed:
  - `apps/worker/src/configured-worker-lifecycle.factory.ts`
  - `apps/worker/src/configured-worker-lifecycle.factory.test.ts`
  - `apps/worker/src/index.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker bootstrap entrypoint is cleaner now, but more service-constructor and singleton/default composition still remains around adjacent worker services
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from service constructors or module-level singleton wiring so composition continues moving outward toward dedicated configured factories

### Phase: Phase 4 worker composition follow-through (2026-03-22, configured deployment worker factory)

- what was built:
  - extracted a dedicated configured deployment-worker factory so the general BullMQ worker factory no longer self-composes a default job processor inline
  - rewired the exported worker singleton to use that new configured factory while preserving the existing queue name, Redis connection, and concurrency behavior
  - kept the base worker factory override-friendly by requiring an explicit processor, which makes the composition boundary clearer in both production wiring and tests
- files created or changed:
  - `apps/worker/src/workers/configured-deployment.worker.factory.ts`
  - `apps/worker/src/workers/configured-deployment.worker.factory.test.ts`
  - `apps/worker/src/workers/deployment.worker.factory.ts`
  - `apps/worker/src/workers/deployment.worker.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker composition root is cleaner now, but more singleton/default wiring still remains around adjacent services and future runtime/backend variants
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from service constructors or module-level singleton wiring so composition continues moving outward toward dedicated configured factories

### Phase: Phase 4 worker storage/runtime composition follow-through (2026-03-22, configured repository factory)

- what was built:
  - extracted a dedicated configured deployment-state-repository factory so `DeploymentStateRepository` no longer self-composes its database queryable inside the constructor
  - rewired the existing top-level repository factory to delegate through that new seam while preserving the current injected-pool override path used by the service wiring and tests
  - kept the storage adapter constructor explicit, which makes the worker repository path match the same factory-first composition pattern used across the other runtime and infrastructure seams
- files created or changed:
  - `apps/worker/src/services/configured-deployment-state.repository.factory.ts`
  - `apps/worker/src/services/configured-deployment-state.repository.factory.test.ts`
  - `apps/worker/src/services/deployment-state.repository.factory.ts`
  - `apps/worker/src/services/deployment-state.repository.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker storage path is cleaner to compose now, but alternate persistence backends and broader operator/day-2 tooling are still future work
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from runtime-adjacent worker services and module-level singleton wiring

### Phase: Phase 4 worker runtime composition follow-through (2026-03-22, configured runner factory)

- what was built:
  - extracted a dedicated configured deployment-runner factory so `DeploymentRunner` no longer self-composes its workspace manager, image builder, and runtime manager defaults inside the constructor
  - rewired the existing top-level deployment-runner factory to delegate through that new composition seam while preserving the current runtime behavior
  - updated runner unit coverage to use explicit injected collaborators by default, which keeps the tests aligned with the same composition boundary used in production
- files created or changed:
  - `apps/worker/src/services/configured-deployment-runner.factory.ts`
  - `apps/worker/src/services/configured-deployment-runner.factory.test.ts`
  - `apps/worker/src/services/deployment-runner.factory.ts`
  - `apps/worker/src/services/deployment-runner.ts`
  - `apps/worker/src/services/deployment-runner.test.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker runtime path is cleaner to compose now, but alternate runtime families and broader day-2 operational tooling are still future work
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from runtime-adjacent worker services so composition continues moving outward toward dedicated seams

### Phase: Phase 4 worker infrastructure/runtime composition follow-through (2026-03-22, adapter-specific factories)

- what was built:
  - extracted dedicated factories for the Caddy service plus the Docker runtime executor, runtime inspector, and container-runtime manager so those concrete infrastructure adapters no longer self-compose outbound HTTP, deployment-runner, or Docker-client dependencies inside their constructors
  - rewired the ingress manager, runtime executor, runtime inspector, and container-runtime-manager family factories to delegate through those new adapter-specific composition seams while preserving the current runtime-family selection behavior
  - updated Caddy service unit coverage to exercise the injected outbound HTTP seam directly instead of mocking global `fetch`, which keeps the tests aligned with the runtime composition boundary
- files created or changed:
  - `apps/worker/src/services/caddy.service.factory.ts`
  - `apps/worker/src/services/caddy.service.factory.test.ts`
  - `apps/worker/src/services/caddy.service.ts`
  - `apps/worker/src/services/caddy.service.test.ts`
  - `apps/worker/src/services/ingress/ingress-manager.factory.ts`
  - `apps/worker/src/services/runtime/docker-runtime-executor.factory.ts`
  - `apps/worker/src/services/runtime/docker-runtime-executor.factory.test.ts`
  - `apps/worker/src/services/runtime/docker-runtime-executor.ts`
  - `apps/worker/src/services/runtime/docker-runtime-inspector.factory.ts`
  - `apps/worker/src/services/runtime/docker-runtime-inspector.factory.test.ts`
  - `apps/worker/src/services/runtime/docker-runtime-inspector.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.factory.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.factory.test.ts`
  - `apps/worker/src/services/runtime/docker-container-runtime-manager.ts`
  - `apps/worker/src/services/runtime/runtime-executor.factory.ts`
  - `apps/worker/src/services/runtime/runtime-inspector.factory.ts`
  - `apps/worker/src/services/runtime/container-runtime-manager.factory.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker infrastructure adapters are cleaner to compose now, but alternate runtime families and broader operator/day-2 tooling are still future work
- next recommended step:
  - continue Phase 4 by removing the next remaining inline defaults from cross-cutting worker infrastructure such as event/webhook wiring or other concrete storage/runtime adapters that still own their own composition
### Phase: Phase 4 worker build/runtime composition follow-through (2026-03-22, build-path composition factories)

- what was built:
  - extracted dedicated factories for the configured build-system resolver, Dockerfile detector, and configured deployment image-builder so those concrete build-path adapters no longer self-compose detector lists, repository inspectors, command runners, or resolvers inside their constructors
  - rewired the existing build-detector, build-system-resolver, and deployment-image-builder top-level factories to delegate through those new composition seams while preserving the current build detection and image-build behavior
  - added focused factory coverage for each new composition seam so the worker build path stays independently testable as Phase 4 keeps splitting responsibilities apart
- files created or changed:
  - `apps/worker/src/services/build-detection/dockerfile-detector.factory.ts`
  - `apps/worker/src/services/build-detection/dockerfile-detector.factory.test.ts`
  - `apps/worker/src/services/build-detection/configured-build-system-resolver.factory.ts`
  - `apps/worker/src/services/build-detection/configured-build-system-resolver.factory.test.ts`
  - `apps/worker/src/services/build-detection/build-system-detector.factory.ts`
  - `apps/worker/src/services/build-detection/build-system-resolver.factory.ts`
  - `apps/worker/src/services/build-detection/configured-build-system-resolver.ts`
  - `apps/worker/src/services/build-detection/dockerfile-detector.ts`
  - `apps/worker/src/services/runtime/configured-deployment-image-builder.factory.ts`
  - `apps/worker/src/services/runtime/configured-deployment-image-builder.factory.test.ts`
  - `apps/worker/src/services/runtime/configured-deployment-image-builder.ts`
  - `apps/worker/src/services/runtime/deployment-image-builder.factory.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker build path is cleaner to extend now, but alternate build-detector families and richer runtime/build adapter variants are still future work
- next recommended step:
  - continue Phase 4 by removing the next remaining self-composed collaborators from the runtime and infrastructure adapters so the remaining concrete worker services depend even less on inline defaults

### Phase: Phase 4 worker archive/runtime composition follow-through (2026-03-22, archive upload composition factories)

- what was built:
  - extracted dedicated factories for the configured archive-upload provider, the configured archive uploader, and the GCS upload provider so those concrete adapters no longer self-compose registries or outbound HTTP clients inside their constructors
  - rewired the archive-upload registry and top-level provider/uploader factories to use those new composition seams while keeping the archive-upload behavior and public interfaces unchanged
  - tightened uploader unit tests around the injected outbound HTTP seam so upload behavior is now validated through the same dependency boundary used in production composition
- files created or changed:
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.factory.test.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.factory.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.factory.test.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.factory.test.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.factory.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.registry.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.test.ts`
  - `apps/worker/src/services/archive-upload/deployment-log-archive-uploader.factory.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.ts`
  - `docs/progress.md`
- what is still missing:
  - the archive-upload branch is now cleaner to extend, but alternate provider registries, richer retry policies, and provider-native SDK composition are still future work
- next recommended step:
  - continue Phase 4 by removing the next remaining self-composed collaborators from the worker runtime/build adapters so concrete services depend even less on inline defaults

### Phase: Phase 4 worker storage/runtime decomposition follow-through (2026-03-22)

- what was built:
  - split the worker archive-upload request/auth layer into provider-specific `http`, `s3`, `gcs`, and `azure` adapters instead of keeping all target-url, signing, and token-fetch logic inside one branching class
  - added a dedicated archive-upload provider registry so the configured selector now delegates by provider key rather than owning every provider implementation detail inline
  - preserved the existing deployment-state/archive-upload behavior while making future provider-native SDK/signing swaps cleaner and more local to one adapter at a time
  - added direct coverage for configured-provider delegation plus registry wiring so the new provider-specific composition stays locked in independently from the broader archive integration tests
- files created or changed:
  - `apps/worker/src/services/archive-upload/archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.shared.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.registry.ts`
  - `apps/worker/src/services/archive-upload/archive-upload-provider.registry.test.ts`
  - `apps/worker/src/services/archive-upload/http-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/s3-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/azure-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.ts`
  - `apps/worker/src/services/archive-upload/configured-archive-upload-provider.test.ts`
  - `docs/progress.md`
- what is still missing:
  - provider-native SDK/signing backends are still future work; this slice just makes that follow-through much easier to land incrementally
- next recommended step:
  - continue Phase 4 by expanding the same storage/runtime seam approach into provider-native adapters or the next remaining runtime/backend abstraction boundary

### Phase: Phase 4 worker storage/runtime decomposition follow-through (2026-03-22, archive builder seam)

- what was built:
  - extracted deployment-log archive format/compression into a dedicated archive-builder seam instead of letting `DeploymentStateService` assemble NDJSON and gzip payloads inline
  - added a default gzip+NDJSON archive-builder implementation plus a factory so future alternate archive formats or compression strategies can be introduced without reopening state-service orchestration
  - added focused unit coverage for the archive-builder output, factory wiring, dependency wiring, and state-service delegation into the injected archive builder
- files created or changed:
  - `apps/worker/src/services/archive-build/deployment-log-archive-builder.ts`
  - `apps/worker/src/services/archive-build/gzip-ndjson-deployment-log-archive-builder.ts`
  - `apps/worker/src/services/archive-build/deployment-log-archive-builder.factory.ts`
  - `apps/worker/src/services/archive-build/gzip-ndjson-deployment-log-archive-builder.test.ts`
  - `apps/worker/src/services/archive-build/deployment-log-archive-builder.factory.test.ts`
  - `apps/worker/src/services/deployment-state-service-dependencies.factory.ts`
  - `apps/worker/src/services/deployment-state-service-dependencies.factory.test.ts`
  - `apps/worker/src/services/deployment-state.service.ts`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `docs/progress.md`
- what is still missing:
  - the archive builder is still a single default format; provider-native archive shapes and richer retention/export formats remain future work
- next recommended step:
  - continue Phase 4 by pulling the next remaining runtime/storage responsibility behind a similarly focused backend seam

### Phase: Phase 4 worker transport/runtime decomposition follow-through (2026-03-22, outbound HTTP client seam)

- what was built:
  - extracted shared outbound HTTP timeout/abort handling into a dedicated client seam instead of letting worker services each hand-roll `fetch` + `AbortController` logic inline
  - rewired Caddy route updates, deployment lifecycle webhook delivery, archive upload transport, and GCS token exchange to use that shared outbound client while preserving each service’s existing operator-facing error wording
  - added focused unit coverage for the new outbound client factory and request behavior so timeout normalization and signal wiring are now locked independently from the higher-level service tests
- files created or changed:
  - `apps/worker/src/services/http/outbound-http-client.ts`
  - `apps/worker/src/services/http/outbound-http-client.factory.ts`
  - `apps/worker/src/services/http/outbound-http-client.test.ts`
  - `apps/worker/src/services/http/outbound-http-client.factory.test.ts`
  - `apps/worker/src/services/caddy.service.ts`
  - `apps/worker/src/services/deployment-events.ts`
  - `apps/worker/src/services/archive-upload/configured-deployment-log-archive-uploader.ts`
  - `apps/worker/src/services/archive-upload/gcs-archive-upload-provider.ts`
  - `docs/progress.md`
- what is still missing:
  - the worker still uses one concrete fetch-backed outbound client; alternate transport implementations and richer retry/policy layering remain future work
- next recommended step:
  - continue Phase 4 by pushing the same seam strategy into the next remaining backend-specific responsibility rather than duplicating transport behavior in new adapters

### Phase: Deployment/auth/config hardening follow-through (2026-03-17)

- what was built:
  - hardened queued-deployment cancellation lookup so queue removal now falls back to the legacy/racey scan path when the direct BullMQ `getJob(deploymentId)` lookup itself fails
  - hardened queued-deployment cancellation cleanup so successful direct `jobId` removal still scans for removable legacy duplicates, while post-success scan failures remain best-effort
  - hardened deployment creation follow-through so project env read/decrypt failures after the deployment row is created now mark that deployment `failed` before the original error is returned, preventing stranded active records that would block later deploys
  - hardened queued cancellation follow-through so successful queue removal now still best-effort marks the deployment `failed` if the final `stopped` persistence write fails, preventing stranded `queued` records that would otherwise block later deploys until stale recovery runs
  - hardened worker state persistence follow-through so deployment log retention trimming is now best-effort after status/log writes, preventing secondary cleanup failures from turning successful worker state transitions into job failures
  - hardened worker state transitions further so `markFailed` and `markStopped` now keep the status write authoritative when the follow-up transition log insert fails, warning instead of surfacing a secondary audit-write failure as the primary lifecycle outcome
  - hardened post-run worker audit logging so route-configuration and final-running log writes are now best-effort after runtime success, preventing successful live deployments from being retried or marked failed just because a trailing informational log insert failed
  - hardened worker post-run failure cleanup so if runtime succeeds but a later persistence/finalization step fails, the worker now best-effort removes the started container/image before retrying, failing, or finalizing cancellation
  - hardened worker informational logging further so pre-run and retry-scheduled log writes are now best-effort too, preventing secondary log insert failures from overriding the true deployment result at any non-authoritative logging stage
  - hardened worker lifecycle event follow-through so `building`, `running`, `failed`, and early `cancelled` event emission are now best-effort after authoritative state transitions, preventing event-sink failures from overriding the real deployment outcome
  - hardened worker cancellation finalization further so if runtime cleanup succeeds but the final `stopped` persistence write fails, the deployment is now best-effort marked `failed` instead of remaining stranded in a queued/building-looking state
  - aligned worker cancellation lifecycle events so `deployment.cancelled` now emits for cancellation completions during runtime cleanup and after execution-error finalization too, not just before execution
  - hardened post-run worker route cleanup so if runtime startup succeeded but a later persistence/finalization step failed, the worker now best-effort removes any configured Caddy route along with the torn-down runtime to avoid leaving stale reverse-proxy entries behind
  - hardened cancellation cleanup follow-through further so worker jobs now only finalize as `stopped` after runtime teardown actually succeeds; repeated cleanup failures now best-effort mark the deployment `failed` instead of claiming cleanup completed
  - hardened worker runtime cleanup signaling so cancellation teardown now surfaces real container/image cleanup failures while still tolerating already-gone Docker resources as benign races
  - hardened worker startup-failure cleanup signaling too so deployment-runner teardown now preserves the original deployment failure context while surfacing real container/image cleanup failures instead of hiding them behind warning-only logging
  - hardened worker workspace cleanup follow-through so temp-directory removal is now best-effort after both successful runs and startup failures, preventing workspace-delete errors from overriding the real deployment outcome
  - deduplicated worker workspace cleanup on startup failures so the runner now relies on the shared final cleanup path instead of attempting temp-directory removal twice and emitting duplicate warnings for the same locked workspace
  - hardened worker `markRunning` transaction rollback follow-through so rollback failures now preserve the original write error context instead of replacing it with a secondary rollback exception
  - hardened worker failed-state persistence so deployments marked `failed` now clear any stale `runtime_url`, preventing dead or reconciled deployments from still advertising a live endpoint after runtime cleanup or reconciliation-driven failure paths
  - hardened startup reconciliation follow-through so missing running containers now trigger best-effort public-route cleanup too, while already-gone Caddy routes are treated as idempotent success instead of noisy cleanup failures
  - hardened dashboard deployment-detail truthfulness further so runtime URLs now render as live links only for actively `running` deployments, preventing stale historical URLs from failed or stopped records from looking like live endpoints on the read side
  - hardened public-route truthfulness end-to-end so worker state persistence now stores `runtime_url` only when route configuration actually succeeds, while dashboard detail pages now describe `running` deployments without a public route explicitly instead of implying those URLs are still pending
  - extracted worker runtime inspection behind a runtime-inspector factory so startup reconciliation now uses the same runtime-family seam as execution, reducing the remaining Docker coupling ahead of future runtime adapter expansion
  - extracted worker ingress management behind an ingress-manager factory so deployment job processing and reconciliation cleanup now share a future-friendly ingress seam instead of naming `CaddyService` directly
  - extracted worker lifecycle event emission behind a deployment-event-sink factory so deployment job processing now depends on a future-friendly event seam instead of a raw webhook emitter function
  - extracted archive upload request/auth generation behind a dedicated provider seam so deployment state management no longer owns S3/GCS/Azure signing internals directly ahead of future storage adapter expansion
  - extracted worker shell command execution behind a deployment-command-runner seam so runtime orchestration no longer owns raw `git clone` / `docker build` / `docker image rm` calls directly ahead of future runtime adapter expansion
  - extracted worker container/network lifecycle behind a container-runtime-manager seam so deployment orchestration no longer binds directly to `dockerode` for network lookup/create, stale-container cleanup, or container start/teardown flows
  - extracted worker workspace preparation/cleanup behind a deployment-workspace-manager seam so runtime orchestration no longer owns direct `fs/promises` workdir setup/teardown flows ahead of future runtime adapter expansion
  - extracted build-file repository inspection behind a repository-file-inspector seam so Dockerfile detection no longer shells out to git directly and future repository/build detectors have a cleaner integration point
  - extracted local archive file handling behind a deployment-log-archive-store seam so deployment state management no longer owns direct archive-dir listing, marker persistence, archive reads, or cleanup deletion flows ahead of future storage/runtime expansion
  - extracted build-system resolution behind a configured resolver seam so deployment orchestration no longer calls a static detector registry directly and future detector stacks have a cleaner injection point
  - extracted repository clone plus image-build orchestration behind a deployment-image-builder seam so runtime orchestration no longer owns direct clone/build/remove-image flows or missing-build-file policy inline inside `DeploymentRunner`
  - extracted archive upload transport and retry behavior behind a deployment-log-archive-uploader seam so deployment state management no longer owns direct fetch/timeout/retry archive push logic inline ahead of future storage/runtime expansion
  - extracted deployment-state construction behind a worker factory seam so the bootstrap path and job-processor defaults no longer name `DeploymentStateService` directly and future state backends have a cleaner composition root
  - extracted BullMQ deployment-worker construction behind a worker factory seam so queue-worker wiring no longer lives inline at the module boundary and future queue backends have a cleaner composition root
  - extracted worker background-scheduler and heartbeat Redis construction behind a dedicated factory seam so the bootstrap entrypoint no longer wires those infrastructure dependencies inline and future scheduler backends have a cleaner composition root
  - extracted deployment-state repository construction behind a dedicated factory seam so state-service composition no longer names `DeploymentStateRepository` directly and future state backends have a cleaner injection point
  - extracted deployment-state database queryable construction behind a dedicated factory seam so repository composition no longer names `pg` pool construction inline and future state backends have a cleaner injection point
  - extracted deployment-runner construction behind a dedicated factory seam so Docker runtime execution no longer names `DeploymentRunner` directly and future runtime backends have a cleaner composition point
  - extracted deployment-job-processor default dependency wiring behind a dedicated factory seam so the processor module no longer names runtime/state/ingress/event/logger defaults inline and future worker composition has a cleaner extension point
  - extracted deployment-state-service default dependency wiring behind a dedicated factory seam so the service constructor no longer names repository, ingress, or archive collaborators inline and future worker composition has a cleaner extension point
  - extracted Docker client construction behind a shared factory seam so Docker-backed runtime adapters no longer name `new Docker(...)` directly and future runtime composition has a cleaner extension point
  - extracted duplicated worker runtime-family selection behind a shared resolver seam so runtime executor, runtime inspector, and container-runtime-manager factories now share one future-friendly executor-type decision point instead of repeating the same branching inline
  - extracted the default build-detector list behind a dedicated factory seam so configured build-system resolution no longer names `DockerfileBuildDetector` directly and future detector stacks have a cleaner extension point
  - extracted shared process-launch behavior behind an exec-file runner seam so Git repository inspection and shell deployment command execution no longer each name raw `execFile` directly, and added direct shell command runner coverage for its git/docker invocation contracts
  - hardened cancellation-state truthfulness on the dashboard so queued/building deployments with `metadata.cancellation.requestedAt` now surface an explicit `cancelling` cue in list views and updated guidance/pipeline details on deployment detail pages
  - extended that cancellation-state truthfulness to compact operational/logging surfaces so status summaries and deployment selectors now show the same explicit `cancelling` cue instead of reverting to plain queued/building copy
  - corrected status-page deployment success metrics so `stopped` deployments are now treated as terminal non-success outcomes instead of being dropped from the summary and showing misleading `N/A` results during cancellation-heavy periods
  - added a real `cancelling` filter on the global Deployments page so operators can isolate queued/building deployments with cancellation pending instead of inferring them only from badges or search terms
  - carried that same cancellation-aware wording into the deployment detail metadata panel so plain-text status readouts now stay aligned with badges, selectors, and filters instead of reverting to raw queued/building backend text
  - corrected stopped deployment detail guidance and pipeline progress so the dashboard now distinguishes pre-activation stops from deployments that were stopped after runtime startup, instead of describing every stopped deployment as if it never reached runtime
  - corrected the top-level Projects overview cards so they now reflect each project's latest deployment status, including cancellation-requested work and per-project deployment-history outages, instead of flattening live projects into a generic `active` badge
  - hardened dashboard log viewers so failed/stopped deployments now keep historical logs visible while surfacing an explicit inactive live-stream state instead of opening an SSE stream that implies new entries are still expected
  - disabled dashboard log-page auto-refresh for terminal deployments too, so stopped/failed records no longer keep polling the route while the UI correctly says no new live log entries are expected
  - corrected the status page’s “Recent Deployment Outcomes” panel so it now shows terminal deployments only and falls back to explicit “still queued/building” guidance when recent activity has not completed yet
  - made cancellation audit-log writes best-effort after cancellation state is already persisted, so transient log insertion failures do not turn a successful cancel into an API error
  - fixed Fastify plugin scoping for auth-context and error-handler registration so sibling `/v1` route plugins inherit token auth resolution and domain-error mapping consistently
  - added API unit coverage for static-token fallback auth, DB-token precedence, explicit dev-auth bypass boundaries, and `requireAuthContext` fallback behavior outside `/v1`
  - hardened `API_TOKENS_JSON` bootstrap parsing so malformed JSON and duplicate token entries now fail startup with explicit config errors instead of surfacing raw parser output or silently shadowing one token entry with another
  - tightened explicit dev-auth fallback semantics so malformed or invalid `Authorization` headers no longer silently grant local admin access when `ENABLE_DEV_AUTH=true`; the bypass now applies only when credentials are absent
  - replaced lossy `z.coerce.boolean()` env parsing with strict string-aware boolean parsing so `.env` values like `ENABLE_DEV_AUTH=false`, `TRUST_PROXY=false`, and `CORS_ALLOW_CREDENTIALS=false` now stay disabled instead of being treated as truthy
  - extracted worker env parsing into a testable core, replaced lossy `z.coerce.boolean()` parsing for `DEPLOYMENT_LOG_ARCHIVE_DELETE_LOCAL_AFTER_UPLOAD`, and fixed worker startup to load root `.env` first plus `apps/worker/.env` as an override so host-run config matches the documented quick-start flow
  - extracted API env-file loading into a shared helper, reused it in `drizzle.config.ts`, and removed the silent fallback database URL so `drizzle-kit` commands now honor the documented root-plus-app-local `.env` flow and fail fast when `DATABASE_URL` is missing
  - pinned `ENABLE_DEV_AUTH` to `false` in the production-like compose API service so host-run development `.env` settings can no longer accidentally bleed into compose startup, and added static regression coverage for that contract
  - removed remaining cwd sensitivity from the API/worker env loaders so repo-root plus app-local `.env` resolution now works even when commands start from `apps/api` or `apps/worker`, with matching loader regression coverage
  - made API tests set required bootstrap env values explicitly instead of using `??=` defaults, so local developer `.env` contents no longer leak into the suite and alter test behavior
  - made worker tests bootstrap a deterministic archive/env baseline before importing the runtime config singleton, so local developer `.env` values no longer leak into archive/service test behavior
  - replaced lossy numeric env coercion in both API and worker config with strict integer parsing, so blank strings now fall back to documented defaults while malformed numeric values fail fast instead of quietly becoming `0` or `NaN`
  - hardened OpenTelemetry bootstrap so `OTEL_ENABLED=yes|on` now behaves consistently with the validated env parser, initialization remains idempotent across repeated calls, and failed optional-dependency startup attempts remain retryable
  - factored API startup/shutdown into a testable lifecycle so listen/build failures now clean up server resources plus telemetry before exit, and repeated shutdown signals share a single cleanup path instead of racing duplicate close attempts
  - factored worker lifecycle wiring into a testable bootstrap helper so ready-path partial failures degrade cleanly, repeated shutdown signals share one cleanup path, and worker close still runs when scheduler shutdown fails
  - made worker ready-path startup work idempotent so reconnect-driven BullMQ `ready` events no longer re-run startup reconciliation or the one-off bootstrap heartbeat publish
  - replaced lossy `z.coerce.number()` parsing on live-log list/stream query parameters so blank `limit`/`pollMs` values now fall back to documented defaults while decimal or malformed inputs fail validation explicitly
  - prevented overlapping alert-monitor evaluations and worker background sweeps so slow interval runs now skip duplicate in-flight work instead of stacking duplicate alerts, archive sweeps, or retention/recovery passes
  - prevented overlapping live-log SSE poll ticks so slow log queries now skip duplicate in-flight reads instead of stacking concurrent stream polls for the same client
  - bounded alert-webhook delivery and Caddy admin route updates with explicit 10-second request timeouts plus clearer network-failure messages, so partial outages fail fast instead of hanging deployment or alerting flows indefinitely
  - normalized timeout failures on alert webhooks, deployment lifecycle webhooks, and Caddy admin route updates so operator logs now use stable `timed out after ...ms` messages instead of raw fetch abort strings
  - normalized GCS token-fetch timeout failures so worker archive token exchange now surfaces the same stable `request timed out after ...ms` message shape instead of raw abort strings
  - normalized deployment lifecycle webhook delivery so blank/whitespace URLs are ignored, outbound requests still time out after 10 seconds, and network failures now log a stable actionable message instead of surfacing raw fetch behavior
  - normalized archive upload retries and GCS token-fetch failures so worker object-storage paths now surface stable “request failed” messages instead of raw fetch transport errors when remote storage or token exchange is unreachable
  - normalized malformed GCS token success responses so invalid JSON bodies now fail with a stable message and bad `expires_in` values fall back to the default cache TTL instead of poisoning the worker token cache
  - hardened worker recovery/archive sweeps so per-item failures now log and continue instead of aborting the whole stuck-recovery, reconciliation, archive-build, or archive-upload pass
  - hardened worker archive sweeps further so unreadable upload entries and undeletable cleanup entries now log and continue instead of aborting the rest of the local artifact pass
  - hardened bootstrap lifecycle handling further so API telemetry-init failures now still clean up and exit consistently, while worker ready-handling can retry when scheduler startup throws synchronously
  - hardened operational alert evaluation so one failing alert webhook send now logs and continues instead of suppressing the remaining health/threshold alerts in the same pass
  - hardened stale container cleanup before deployment runs so one failing old container removal now logs and continues instead of blocking later stale cleanup candidates
  - hardened operational alert evaluation further so failing queue-metrics or worker-health reads now log and continue instead of suppressing alerts from the other signal source
  - hardened API and worker Redis queue configuration parsing so malformed `REDIS_URL` database paths now fail fast instead of being coerced into invalid BullMQ connection settings
  - hardened worker deployment-network creation so Docker “already exists” races now recheck and continue instead of failing the whole deployment start path
  - hardened worker archive upload follow-through so local delete failures after a successful remote upload now log a dedicated warning instead of downgrading the upload result
  - hardened worker archive idempotency further so existing `.uploaded` markers are detected by filesystem existence instead of file readability, preventing duplicate uploads when a marker survives in a non-file form
  - added regression coverage that exercises the real production registration shape, proving root auth/error plugins still apply when protected routes live inside sibling route plugins
  - added focused auth-helper coverage for scope enforcement, user access checks, owner/admin bypass behavior, membership-based project access, and project-not-found handling
  - fixed the project detail route so membership-based access is honored consistently instead of restricting `GET /projects/:projectId` to only owners/admins
  - updated project listing semantics so membership-accessible projects appear alongside owned projects for the requesting user context
  - scoped deployment-queue construction to the deployments Fastify plugin lifecycle and added best-effort shutdown cleanup so route registration no longer leaks BullMQ handles at module import time
  - added deployments-route regression coverage so project-member list/create access and cancel-scope enforcement are verified directly at the route layer
  - completed the deployments-route auth matrix with direct coverage for list read-scope rejection, create write-scope rejection, outsider denial on create/cancel, and the successful member cancel path
  - added environment/logs route regression coverage so project-member resource access and route-level scope enforcement are verified directly beyond the shared auth helper tests
  - completed the environment route auth matrix with direct coverage for read-scope rejection, write-scope rejection on upsert, outsider denial on upsert/delete, and the successful member delete contract
  - extended logs-route regression coverage to the SSE stream endpoint so missing `logs:read` scope and outsider project access are rejected there too, not just on list/export paths
  - added api-token route regression coverage for admin cross-user list/create/revoke access, user-boundary denial, missing write scope, and token rotate/revoke not-found handling
  - completed the api-token route auth matrix with direct coverage for list read-scope rejection, successful admin rotate, cross-user rotate/revoke denial, and missing write-scope rejection on rotate/revoke
  - completed the projects-route auth matrix with direct coverage for admin cross-user create/list access, user-boundary denial on create/list, missing `projects:write` rejection on create, and missing `projects:read` rejection on list/get
  - added alert-monitor service coverage for queue metric shaping, worker heartbeat unavailable/stale handling, webhook cooldown behavior, and operational alert threshold fan-out
  - hardened alert-monitor lifecycle so repeated `start()` calls do not stack duplicate polling intervals, and added direct coverage for idempotent start/stop behavior plus warning-path logging on initial/interval failures
  - hardened worker background scheduler lifecycle so repeated `start()` calls no longer stack duplicate interval tasks after BullMQ `ready` reconnects, and added direct lifecycle coverage for idempotent start/stop behavior
  - added injected-dependency coverage for API `/health`, `/health/queue`, and `/health/worker` so request-id propagation, queue-health failure mapping, stale-worker semantics, and clean shutdown of the monitor/queue/redis clients are verified without requiring real Redis or BullMQ runtime access
  - extended `buildServer()` regression coverage so thrown worker-health checks map to explicit `503 unavailable` payloads and app shutdown still completes cleanly when queue or Redis close hooks fail
  - hardened API `/metrics/queue` and `/metrics/worker` so async metric collection failures map to explicit `503 unavailable` payloads instead of bubbling as generic `500` responses, and added regression coverage for degraded queue health plus raw metrics passthrough/failure behavior
  - fixed `buildServer()` route registration scope so global rate limiting now applies to the health endpoints and sibling `/v1` route plugins instead of silently missing those routes
  - made disallowed CORS origins raise an explicit `403` operational error instead of falling through the shared error handler as a generic `500`
  - added explicit `TRUST_PROXY` support in API env/config and enabled it in compose so proxy-forwarded client IPs can drive rate-limit allowlists behind Caddy/cloudflared
  - preserved explicit operational status codes from non-domain Fastify/plugin errors in the shared error handler, so rate-limit rejections now stay `429` instead of being flattened into `500`
  - added direct ingress regression coverage for allowlisted and blocked CORS origin handling, trusted-proxy-aware forwarded IP rate-limit behavior, rate-limit headers/throttling, and shared error-handler preservation of plugin-provided `429` responses
  - hardened the live logs SSE route so polling failures now emit a final stream error event and close cleanly instead of risking unhandled async failures during long-lived streams
  - decoupled dashboard platform-health reads from demo-user/project live-data requirements so queue/worker status still renders when `NEXT_PUBLIC_DEMO_USER_ID` is unset or project-scoped reads are unavailable
  - updated the dashboard status page so deployment-history metrics are labeled as unavailable during project-scoped live-data outages while platform health remains visible
  - made dashboard platform-health fetching resilient per endpoint and aligned the `API` badge to the API `/health` endpoint instead of inferring it from queue/worker responses
  - preserved upstream worker `stale` health semantics in the dashboard client so non-200 operational warnings are no longer flattened into generic unavailable states
  - corrected top-level demo-mode copy so missing dashboard user context or auth failures no longer present themselves as generic API outages
  - hardened the global projects, deployments, status, and logs loaders so per-project deployment-read failures now degrade into partial-outage banners and incomplete-but-live results instead of collapsing whole views into fallback or misleading empty states
  - hardened the project detail page so deployment-history or environment-variable read failures now degrade the affected panels in place instead of taking down the full project route
  - hardened the project-scoped deployments, environment, and logs pages so secondary live-data reads now degrade into partial-outage guidance and in-place unavailable panels instead of failing the whole route after the project record has already loaded
  - hardened the global environment shortcut so selected-project variable reads now degrade into an in-place unavailable panel instead of dropping the whole route after project selection succeeds
  - hardened deployment detail routing so partial-outage gaps in the shared deployment list now render an unavailable state instead of incorrectly claiming the deployment no longer exists
  - hardened the token settings view so token-list read failures now degrade into an in-place inventory-unavailable panel while the create-token flow remains available
  - hardened deployment detail pages further so they now show a partial-outage banner when the current deployment is available but the surrounding live deployment history is incomplete
  - bounded dashboard server-side live-data and log-proxy fetches with explicit 10-second timeouts so hung upstream API calls now degrade into explicit timeout/unavailable states instead of stalling route rendering
  - hardened the dashboard queue-trend poller so slow health snapshots no longer stack overlapping client requests and stale in-flight polls are aborted on timeout or unmount
  - hardened deployment/log auto-refresh widgets so they now skip refreshes while a prior transition is pending and avoid background-tab churn when the document is hidden
  - hardened the live log EventSource client so hidden tabs pause streaming and visible tabs reconnect from a replay-safe cursor instead of holding stale background streams open
  - added an in-panel reconnect path for live log stream failures so operators no longer need to refresh the whole page to resume streaming after a transient disconnect
  - expanded API unit coverage for queue-cancel race/idempotency behavior and cancellation partial-failure behavior
  - aligned README quick-start guidance with actual compose expectations (required secrets, optional dashboard auth vars, and separation between compose runtime vs direct workspace `.env` files)
  - aligned the production-readiness audit wording with the current compose/auth defaults so it no longer claims compose enables dev auth by default
  - recalibrated the top-level phase snapshot so the reported percentages reflect the hardening and dashboard resilience work already landed
  - refreshed deployment-flow/progress wording so cancellation semantics and auth safety notes match the current implementation
- files created or changed:
  - `apps/api/src/queue/deployment-queue.ts`
  - `apps/api/src/queue/deployment-queue.test.ts`
  - `apps/api/src/modules/deployments/deployments.service.ts`
  - `apps/api/src/modules/deployments/deployments.service.test.ts`
  - `apps/api/src/plugins/auth-context.ts`
  - `apps/api/src/plugins/auth-context.test.ts`
  - `apps/api/src/plugins/error-handler.ts`
  - `apps/api/src/server/api-routes.test.ts`
  - `apps/api/src/server/build-server.ts`
  - `apps/api/src/server/build-server.test.ts`
  - `apps/api/src/modules/auth/auth-utils.test.ts`
  - `apps/api/src/modules/projects/projects.repository.ts`
  - `apps/api/src/modules/projects/projects.routes.ts`
  - `apps/api/src/modules/projects/projects.routes.test.ts`
  - `apps/api/package.json`
  - `package-lock.json`
  - `README.md`
  - `docs/deployment-flow.md`
  - `docs/production-readiness-audit.md`
  - `docs/progress.md`
- what is still missing:
  - broader production-readiness and auth-model work is still pending, especially observability depth, worker decomposition, backup/restore validation, and longer-term user/runtime model evolution
- known issues:
  - direct `npm` PowerShell shims are blocked in this environment, so validation commands should use `npm.cmd`
- next recommended step:
  - continue reducing bootstrap-only auth fallbacks in regular dev flows and tighten end-to-end operational validation around compose/runtime lifecycle, especially around health/compose startup behavior

### Phase: UI/UX implementation tranche (2026-03-14)

- progress marker:
  - **Phase 1.8 complete**: standardized action feedback and pending states across projects/tokens/environment, fixed live-vs-mock fallback behavior, and redirected deploy trigger directly to deployment detail.
  - **Phase 2.1 started**: introduced project-centric navigation with new `/projects/[id]` page and loading skeleton.
  - **Phase 2.2 advanced**: deployment detail now includes pipeline step visualization (queued/build/start/route), inferred failed-step highlighting, and a human-readable failure summary extracted from recent error logs.
  - **Phase 2.3 started**: project-centric IA migration now has true nested routes for environment and logs under `/projects/[id]`.
- what was built in this tranche:
  - added shared client helpers:
    - `apps/dashboard/components/action-toast.tsx` for `status/message` toast delivery + URL cleanup
    - `apps/dashboard/components/form-submit-button.tsx` for consistent pending submit behavior
    - `apps/dashboard/components/deployment-auto-refresh.tsx` for active deployment polling
  - migrated key interactions to pending-aware flows:
    - projects deploy/create, token create/rotate/revoke, environment save/delete
  - improved UI consistency and accessibility:
    - moved several raw buttons to `Button` variants
    - added sr-only labels for form controls in projects/tokens/environment/logs
    - removed duplicate log rendering and unified live log panel styling with design tokens
    - made deployment runtime URL clickable
  - added project overview route:
    - `apps/dashboard/app/projects/[id]/page.tsx`
    - `apps/dashboard/app/projects/[id]/loading.tsx`
  - added cross-navigation affordances:
    - project links from deployments/logs/environment contexts
  - expanded deployment trust UX:
    - pipeline progress card on deployment detail with dynamic step states
    - failure summary card that normalizes raw error log messages into actionable text
  - improved project-centric navigation from project overview:
    - added Project Actions shortcuts to environment, logs, and deployments feed
  - introduced nested project routes:
    - `apps/dashboard/app/projects/[id]/environment/page.tsx` + route-local actions and loading state
    - `apps/dashboard/app/projects/[id]/logs/page.tsx` + loading state
    - rewired project/deployment links to use project-scoped logs/environment paths
  - refined top-level routes as global shortcuts:
    - added explicit CTA from `/environment` to `/projects/[id]/environment`
    - added explicit CTA from `/logs` to `/projects/[id]/logs`
  - normalized dropdown UX with shared design-system Select styling:
    - added shared `components/ui/select.tsx` wrapper for consistent dark-theme select controls
    - migrated deployment/project/token role dropdowns to the shared Select component
  - improved log and token form readability:
    - shortened deployment labels in log selectors (truncated id + relative age + status)
    - grouped API token scopes into semantic categories with two-column layout
  - improved Projects page action ergonomics:
    - added a collapsible `ProjectCreatePanel` with a clear `New Project` primary CTA
    - default-open create form when there are zero projects or after create validation errors
  - established Settings route tree for account-level concerns:
    - added `/settings` overview page and moved token management to `/settings/tokens`
    - kept `/tokens` as a backward-compatible redirect shortcut to `/settings/tokens`
  - improved deployments list scanability:
    - added status filtering on `/deployments` with `all/queued/building/running/failed/stopped` options
    - wired filtered table rendering without changing existing deployment detail links
  - improved deployments empty-state guidance:
    - added contextual filtered-empty messaging (e.g., `No failed deployments`)
    - added explicit CTA buttons to `Clear filter` and `Open Projects` when no deployments match
  - expanded deployments filtering controls:
    - added project filter to `/deployments` in addition to status filtering
    - updated empty-state recovery action to clear both filters together
  - started shared EmptyState pattern adoption:
    - added reusable `components/empty-state.tsx`
    - migrated deployments empty-state rendering to shared component with CTA slot
  - started shared page-header pattern adoption:
    - added reusable `components/page-header.tsx` for consistent page titles/descriptions
    - migrated Projects, Deployments, and Settings top headers to shared component
  - completed shared page-layout pattern adoption:
    - reused `components/page-layout.tsx` in remaining global/detail pages (`/logs`, `/environment`, `/projects/[id]`, `/deployments/[id]`) to remove repeated `mx-auto max-w-5xl space-y-6` wrappers
  - expanded shared EmptyState adoption for global shortcuts:
    - migrated `/environment` empty project/variable states to `components/empty-state.tsx` with clearer guidance + CTA
    - migrated `/logs` empty deployments state to `components/empty-state.tsx` with CTA back to Projects
  - completed destructive-action dialog migration:
    - added reusable `components/ui/dialog.tsx` primitive for modal confirmations
    - refactored `components/confirm-submit-button.tsx` to use the shared dialog wrapper instead of inline modal markup
  - reduced token-page duplication:
    - extracted token manager UI into reusable `components/token-management-page.tsx`
    - simplified `/settings/tokens` route to compose shared token manager component
  - improved settings IA orientation:
    - added reusable `components/settings-subnav.tsx` for settings-local navigation
    - integrated settings sub-navigation on both `/settings` and `/settings/tokens`
  - aligned Settings routes with loading-state standards:
    - added `/settings/loading.tsx` skeleton
    - added `/settings/tokens/loading.tsx` skeleton
  - improved global keyboard accessibility:
    - added a skip-to-content link in root dashboard layout
    - added `id="main-content"` main landmark target for keyboard navigation
  - improved badge semantics for assistive technology:
    - updated shared `Badge` primitive to render as inline `<span>` instead of `<div>`
  - expanded shared EmptyState adoption:
    - migrated Projects empty state to reusable `EmptyState`
    - migrated token-manager empty/no-context states to reusable `EmptyState`
  - improved destructive-action accessibility:
    - replaced `window.confirm()` flow in `ConfirmSubmitButton` with a modal dialog confirmation
    - added focus trap + focus return behavior for keyboard users in confirmation dialog
  - started shared PageLayout adoption:
    - added reusable `components/page-layout.tsx` (`max-w-5xl` + vertical rhythm wrapper)
    - migrated Projects, Deployments, Settings, and token-manager pages to use shared layout wrapper
  - improved mobile navigation ergonomics:
    - added responsive/collapsible sidebar drawer for small screens with overlay + close controls
    - kept desktop sidebar behavior unchanged on `md+` breakpoints
  - added project-scoped sub-navigation component (`Overview`, `Environment`, `Logs`) and integrated it across nested project pages for faster context switching
  - expanded project sub-navigation and IA:
    - added `/projects/[id]/deployments` (+ loading state)
    - updated subnav to include `Deployments`
    - rewired project overview action to stay in project-scoped deployments view
  - implemented one-click deploy/redeploy actions in project-scoped surfaces:
    - added shared server action `apps/dashboard/app/deployments/actions.ts`
    - wired `Deploy` on project overview/deployments pages and `Redeploy` on deployment detail
  - completed stale-data feedback loop:
    - added reusable `LastRefreshedIndicator` component
    - integrated last-refresh + stale warning messaging on deployment detail and logs views
  - completed relative-time readability update:
    - added shared `formatRelativeTime` helper
    - switched deployment list timestamps to relative format with absolute hover tooltips
  - improved live log filtering ergonomics:
    - added log-level filter control (`all/error/warn/info/debug`) to `LogsLiveStream`
    - added visible filtered-count indicator and empty-filter messaging
  - improved live log investigation workflow:
    - added text search input in `LogsLiveStream` (message/level/timestamp match)
    - added `Scroll to bottom` control for quicker tail-following during live streams
- what is still missing:
  - complete project-centric IA migration (move environment/log workflows under project route tree)
  - deployment step visualization (clone/build/start/route) and human-readable failure summaries
  - replace remaining native control patterns with consistent shadcn primitives where needed
- known issues:
  - live browser session may show stale UI until dashboard container/process is rebuilt and restarted
- next recommended step:
  - continue Phase 2 with deployment progress model (step timeline + failure summary card), then refactor logs/environment into project-scoped routes

### Validation checkpoint (2026-03-14, combined pass)

- full verification run completed across changed dashboard + API + worker + infra files:
  - `npm run typecheck` passed for all workspaces
  - `npm run lint` passed after fixing OTEL lint guard + dashboard input typing lint rule
  - `npm run build` passed for all workspaces (including Next.js production build)
  - API tests passed (`8/8`)
  - worker tests passed (`18/18`) after aligning one stale unit-test expectation with current error-log insertion signature
  - worker `npm test` script made Windows-compatible (removed POSIX-only inline env assignment)
  - `docker compose config` parsed successfully (with non-blocking warnings about unset `CLOUDFLARED_TOKEN` and obsolete compose `version` key)
- files updated during this validation checkpoint:
  - `apps/api/src/telemetry/otel.ts`
  - `apps/dashboard/components/ui/input.tsx`
  - `apps/worker/src/services/deployment-state.service.test.ts`
  - `apps/worker/package.json`

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
  - `apps/api/src/server/domain-errors.ts` â€” added `statusCode` to `DomainError`, added `ApiTokenNotFoundError`
  - `apps/api/src/plugins/error-handler.ts` â€” auto-maps `DomainError` â†’ HTTP with structured logging
  - `apps/api/src/modules/deployments/deployments.routes.ts` â€” removed try/catch blocks and unused imports
  - `apps/api/src/modules/projects/projects.routes.ts` â€” removed try/catch blocks and unused imports
  - `apps/api/src/modules/environment/environment.routes.ts` â€” removed try/catch blocks and unused imports
  - `apps/api/src/modules/logs/logs.routes.ts` â€” removed try/catch blocks and unused imports
  - `apps/api/src/modules/api-tokens/api-tokens.routes.ts` â€” removed try/catch blocks, uses `ApiTokenNotFoundError`
  - `apps/api/src/plugins/auth-context.ts` â€” `ENABLE_DEV_AUTH` flag, removed legacy plaintext fallback
  - `apps/api/src/config/env.ts` â€” added `ENABLE_DEV_AUTH` env variable
  - `apps/api/src/index.ts` â€” added graceful shutdown (SIGTERM/SIGINT)
  - `apps/api/src/types/shared-types.d.ts` â€” cleared ambient declarations
  - `apps/worker/src/types/shared-types.d.ts` â€” cleared ambient declarations
  - `docs/production-readiness-audit.md` â€” recreated comprehensive audit document
- what is still missing:
  - `apps/api/src/server/http-errors.ts` should be deleted (fully unused dead code)
  - Phase 2: Production Reliability (streaming log export, DB pool limits, state reconciliation, API tests)
  - Phase 3: UI/UX Polish (dashboard route extraction, shadcn/ui, status badges, toasts, loading states)
  - Phase 4: Extensibility (alert extraction, worker decomposition, event hooks, multi-user)
- known issues:
  - compose runtime cannot be executed in this environment due to missing Docker CLI
  - `ENABLE_DEV_AUTH=true` must be set explicitly in development `.env` files for the dev-auth bypass path to work â€” this is an intentional breaking change for safety
- next recommended step:
  - begin Phase 2: Production Reliability (state reconciliation, DB pool limits, streaming log export, API tests)

### Phase 1 completion: token URL fix + type cleanup (2026-03-12)

- what was built:
  - **Removed token plaintext from URL parameters** (CRITICAL security fix): `createApiTokenAction` and `rotateApiTokenAction` no longer pass the token via `?tokenPlaintext=...` in the redirect URL. Instead, the token is set as a short-lived HTTP-only cookie (`__token_plaintext`, `maxAge: 120`, `sameSite: strict`, `secure` in production). The `DashboardPage` component reads and immediately deletes the cookie on render, displaying the token in the existing amber "copy now" box. This eliminates exposure via browser history, server logs, address bar, and Referer headers.
  - **Removed `next-shims.d.ts` stub declarations**: cleared the file that declared incomplete stubs for `next/server`, `next/cache`, and `next/navigation`, which were shadowing the real Next.js types. Real types now resolve from the `next` package via `next-env.d.ts`.
  - **Confirmed `http-errors.ts` already deleted**: the dead code file was removed between sessions.
- files created or changed:
  - `apps/dashboard/app/page.tsx` â€” cookie-based token flash (import `cookies` from `next/headers`, set cookie in server actions, read+delete in page component), removed `tokenPlaintext` from `searchParams` interface
  - `apps/dashboard/types/next-shims.d.ts` â€” cleared stub declarations
  - `docs/production-readiness-audit.md` â€” marked Phase 1 items 5+6 complete, updated security matrix
- what is still missing:
  - Phase 1 is now COMPLETE â€” all 6 items done
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
  - **API integration tests**: 8 tests using Fastify's `inject()` covering all domain error â†’ HTTP status code mappings, non-domain error â†’ 500, and 404 not-found handler. Uses Node's built-in test runner (`node:test` + `node:assert`).
  - **Database backup documentation**: created `docs/database-backup.md` with pg_dump strategy, Docker Compose sidecar option, retention tiers (daily/weekly/monthly), restore procedure, verification steps, and encryption recommendations.
- files created or changed:
  - `apps/worker/src/index.ts` â€” startup reconciliation call + Docker import
  - `apps/worker/src/services/deployment-state.repository.ts` â€” `listRunningDeploymentContainers()`, pool config
  - `apps/worker/src/services/deployment-state.service.ts` â€” `reconcileRunningDeployments()`
  - `apps/worker/src/config/env.ts` â€” DB pool config vars
  - `apps/api/src/config/env.ts` â€” DB pool config vars
  - `apps/api/src/db/client.ts` â€” pool limits applied
  - `apps/api/src/modules/logs/logs.routes.ts` â€” streaming gzip export
  - `apps/api/src/server/api-routes.test.ts` â€” new test file (8 tests)
  - `apps/api/package.json` â€” added `test` script
  - `docs/database-backup.md` â€” new backup strategy doc
  - `docs/production-readiness-audit.md` â€” Phase 2 items marked complete
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
    - `/projects` â€” project list, create form, deploy trigger actions
    - `/deployments` â€” deployment table with status badges and quick links
    - `/deployments/[id]` â€” deployment detail with timeline, metadata, and logs
    - `/tokens` â€” API token CRUD (create/rotate/revoke) with cookie-based token flash
    - `/environment` â€” environment variable management per project
    - `/logs` â€” deployment log viewer with auto-refresh, live stream, and NDJSON/GZIP export
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
  - `apps/dashboard/lib/helpers.ts` â€” shared helper functions
  - `apps/dashboard/lib/loaders.ts` â€” centralized data loader
  - `apps/dashboard/lib/utils.ts` â€” `cn()` className merge utility
  - `apps/dashboard/components/ui/button.tsx` â€” CVA Button
  - `apps/dashboard/components/ui/badge.tsx` â€” CVA Badge with semantic variants
  - `apps/dashboard/components/ui/card.tsx` â€” Card components
  - `apps/dashboard/components/ui/input.tsx` â€” Input component
  - `apps/dashboard/components/ui/label.tsx` â€” Label component
  - `apps/dashboard/components/ui/sonner.tsx` â€” Toaster wrapper
  - `apps/dashboard/components/sidebar.tsx` â€” navigation sidebar
  - `apps/dashboard/components/platform-status.tsx` â€” layout-level status wrapper
  - `apps/dashboard/app/projects/page.tsx` â€” projects route
  - `apps/dashboard/app/projects/actions.ts` â€” project server actions
  - `apps/dashboard/app/projects/loading.tsx` â€” projects skeleton
  - `apps/dashboard/app/deployments/page.tsx` â€” deployments route
  - `apps/dashboard/app/deployments/loading.tsx` â€” deployments skeleton
  - `apps/dashboard/app/deployments/[id]/page.tsx` â€” deployment detail
  - `apps/dashboard/app/tokens/page.tsx` â€” tokens route
  - `apps/dashboard/app/tokens/actions.ts` â€” token server actions
  - `apps/dashboard/app/tokens/loading.tsx` â€” tokens skeleton
  - `apps/dashboard/app/environment/page.tsx` â€” environment route
  - `apps/dashboard/app/environment/actions.ts` â€” env var server actions
  - `apps/dashboard/app/environment/loading.tsx` â€” environment skeleton
  - `apps/dashboard/app/logs/page.tsx` â€” logs route
  - `apps/dashboard/app/logs/loading.tsx` â€” logs skeleton
  - `apps/dashboard/app/error.tsx` â€” route error boundary
  - `apps/dashboard/app/global-error.tsx` â€” root error boundary
  - `apps/dashboard/app/not-found.tsx` â€” 404 page
- files changed:
  - `apps/dashboard/app/page.tsx` â€” replaced with redirect to `/projects`
  - `apps/dashboard/app/layout.tsx` â€” added Sidebar, PlatformStatus, Toaster, Suspense
  - `apps/dashboard/app/globals.css` â€” CSS variable dark theme
  - `apps/dashboard/tailwind.config.ts` â€” CSS variable colors, animate plugin
  - `apps/dashboard/tsconfig.json` â€” `@/*` path alias
  - `apps/dashboard/package.json` â€” shadcn/ui dependencies
  - `apps/dashboard/components/deployment-table.tsx` â€” Badge status, UUID truncation, detail links
  - `apps/dashboard/components/project-card.tsx` â€” Card + Badge integration
  - `apps/dashboard/components/platform-status-strip.tsx` â€” Badge variants, design tokens
  - `docs/production-readiness-audit.md` â€” Phase 3 marked complete
  - `docs/progress.md` â€” Phase 3 entry
- what is still missing:
  - Phase 3 is now COMPLETE â€” all 10 items done
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
  - dashboard project-create form now has optimistic pending state (`Creatingâ€¦`) and disables submit while action is in flight
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

- [~] Static checks attempted in current environment (shared-types `build`, API `typecheck`/`test`, worker `typecheck`/`test`, and dashboard `typecheck`/`lint` are all passing as of 2026-03-29 after the managed Postgres operations batch, with API tests now at `314/314` and worker tests at `235/235`; broader workspace validation is still missing only the true end-to-end compose/runtime pass in this environment)
- [ ] End-to-end compose validation (blocked by missing Docker CLI in this environment)
- [~] Typecheck/test execution with installed dependencies (shared-types, API, dashboard typecheck, and worker package verified; broader workspace install/validation still environment-dependent)

---

## Immediate Next Recommended Steps

1. Continue managed databases v1 with managed Postgres follow-through: add backup scheduling / restore scaffolding plus clearer recovery/audit visibility around provisioned resources before broadening the managed-data surface further.
2. After that Postgres follow-through is in place, decide whether the next managed-data slice should stay in Postgres (for example storage classes and stricter lifecycle controls) or expand the same resource pattern to MongoDB / Redis.
