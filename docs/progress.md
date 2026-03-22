# Vcloudrunner MVP Progress Tracker

Last updated: 2026-03-22 (Phase 4 worker transport/runtime decomposition)

## Legend

- [x] Done
- [~] In progress / partial
- [ ] Not started



## Phase Status Snapshot (2026-03-22)

- **Phase 1: Critical stabilization** — ~99% complete
  - done: deployment concurrency invariant (service + DB), queue enqueue failure mapping/state correction, deployment-create env-resolution failure correction so decrypt/read failures no longer strand active deployments, queued-cancel race/idempotency hardening, safer compose defaults, production dev-auth startup guard, stricter bootstrap token startup validation, strict env-boolean parsing for auth/ingress and worker archive-lifecycle flags, strict numeric env parsing for API/worker runtime settings so blank strings no longer coerce to `0`, telemetry startup that now honors the same boolean env semantics as the validated config layer, explicit rejection of invalid credentials during dev-auth fallback flows, root auth/error plugin inheritance fix, host-run worker `.env` loading that now matches the documented app-local override flow, cwd-independent repo-root env resolution for API/worker startup and API `drizzle-kit` commands, aligned `drizzle-kit` env loading/fail-fast behavior with the API runtime, pinned compose API dev auth off independently from local host-run `.env` settings, stricter Redis queue URL parsing so explicit database paths must be integer indexes instead of silently coercing invalid values, broader API auth/deployment regression coverage, fuller api-token route access coverage, and clearer dashboard auth/config failure states
  - left (~1%): rotate any legacy local secrets in existing environments, keep reducing bootstrap-only auth fallback usage in regular dev flows, and add a small amount of end-to-end compose/runtime validation beyond unit coverage
- **Phase 2: Production readiness foundation** — ~99% complete
  - done: improved failure taxonomy coverage, regression tests around constraint/error mapping paths, stronger cancellation/auth/config resilience under partial failures, direct route-level authorization coverage across the main API surfaces including SSE log streaming, the full deployment write/cancel path, the full API-token list/rotate/revoke path, the full environment read/write path, and the full top-level project read/write path, alert-monitor/operational-threshold unit coverage, idempotent alert-monitor startup behavior, overlap-safe alert-monitor polling during slow evaluations, fail-fast alert webhook delivery under network hangs, timeout-normalized alert/webhook/control-plane delivery failures across alert webhooks, deployment lifecycle webhooks, Caddy route updates, and GCS token exchange, idempotent worker background scheduler startup behavior, overlap-safe worker background task scheduling during slow sweeps, overlap-safe live-log SSE polling during slow log queries, fail-fast Caddy route updates with stable network-failure reporting, normalized deployment lifecycle webhook delivery under blank-url and network-failure cases, normalized archive upload and GCS token-fetch network failures under retry/timeout conditions, post-upload local archive cleanup that now degrades to a warning instead of downgrading a successful remote upload, best-effort deployment-log retention enforcement after worker state/log writes so secondary log trimming failures no longer turn successful transitions into job failures, best-effort failure/stop audit-log insertion after worker state transitions so post-status log insert failures no longer poison otherwise successful lifecycle writes, best-effort worker audit logging across pre-run, retry-scheduled, and post-run phases so informational log insert failures no longer override the real deployment outcome, best-effort worker deployment-event emission after authoritative state changes so lifecycle event sink failures no longer override the real build/running/failed outcomes, cancellation finalization safety fallbacks so cancelled worker jobs are best-effort marked `failed` when runtime cleanup succeeds but the final `stopped` persistence write still fails, consistent `deployment.cancelled` event emission for cancellation completions before execution, during execution, and after execution-error finalization, cancellation cleanup enforcement so worker jobs no longer finalize as `stopped` when runtime teardown still fails, runtime-cleanup failure propagation that now distinguishes real teardown failures from already-gone container/image races during cancellation finalization, startup-failure runtime cleanup propagation that now preserves the original deployment error context while surfacing real container/image teardown failures from the runner path, best-effort runtime and Caddy route cleanup after post-run persistence failures so torn-down deployments no longer leave live containers/images or stale reverse-proxy routes behind, per-item continuation across worker reconciliation/archive/upload/cleanup sweeps so one bad deployment or corrupted local artifact no longer aborts the full pass, per-item continuation across stale pre-run container cleanup so one failing old container removal no longer blocks later cleanup candidates, per-alert continuation inside operational alert evaluation so one failing webhook send no longer suppresses later alerts in the same cycle, per-signal continuation inside operational alert evaluation so broken queue metrics or worker-health reads no longer suppress alerts from the other source in the same cycle, normalized malformed GCS token success responses so invalid JSON and bad `expires_in` values no longer leak parser failures or poison the worker token cache, direct API health/shutdown regression coverage, fuller worker-health failure mapping and shutdown-resilience coverage in `buildServer()`, direct server-metrics contract coverage with explicit unavailable mapping, explicit ingress-contract coverage for allowlisted CORS plus global rate-limit headers/throttling, explicit `403` handling for disallowed CORS origins, proxy-aware forwarded-client rate-limit handling via configurable trusted-proxy support, preserved plugin-provided operational status codes like rate-limit `429` through the shared error handler, deterministic API and worker test bootstrap env fixtures that no longer inherit local developer `.env` values, startup/shutdown lifecycle hardening around the API and worker bootstrap paths, retryable worker ready-handling after synchronous scheduler-start failures, startup-failure cleanup even when API telemetry initialization itself throws, guarded worker startup work against repeated `ready` events, stricter integer parsing on live-log route query controls, worker deployment-network creation that now tolerates “already exists” races during startup, and clearer operator-facing startup/config guidance
  - left (~1%): deeper observability dimensions, migration safety gates, backup/restore automation checks, worker/service decomposition, and broader operational validation
- **Phase 3: UI/UX trust and polish** — ~100% complete
  - done: route architecture, loading/error boundaries, action feedback helpers, clearer deployment error messages, stopped-status consistency, in-context failure handling, live-data unavailable/degraded states across the dashboard, platform-health visibility even when project-scoped live data is unavailable, clearer status-page behavior under partial outages, more truthful platform-health badge semantics, preserved worker stale/unavailable distinctions, more accurate demo-mode/live-data messaging on top-level pages, timeout-bounded dashboard live-data/log-proxy fetching so hung upstream calls degrade into explicit timeout states instead of hanging route rendering, overlap-safe client-side queue-health polling for operational widgets, pending-aware/visibility-aware auto-refresh loops for deployment and log views, visibility-aware live log streaming with replay-safe resume behavior plus in-panel reconnect recovery, terminal-state-aware log streaming so stopped/failed deployments now keep historical logs visible without pretending to be actively streaming, terminal-state-aware log auto-refresh so stopped/failed deployments no longer keep polling the route while saying no new live logs are expected, partial-outage-aware global deployment/history loaders so one failing project no longer blanks top-level dashboard views, partial-outage-aware project detail panels so deployment or environment read failures no longer take down the full project page, project-scoped deployment/environment/log routes that now stay usable when their secondary live-data reads fail, a global environment shortcut that now stays live when the selected project’s variable read fails, deployment detail routing that no longer turns partial-outage misses into false not-found states, token settings that now keep creation available when the token inventory read fails, deployment detail pages that now explicitly disclose surrounding history outages when the current deployment remains available, status-page outcome summaries that now stay terminal-only, truthful operational-card labeling for running-deployment recency, and cancellation-requested deployment states that now show an explicit `cancelling` cue plus updated queued/building/stopped guidance across detail, summary, log-selector, project-overview, operational-metric, global-filter, and plain-text detail surfaces instead of masquerading as normal in-progress work
  - left (~0%): core UI/UX trust and polish goals are complete; only optional future polish remains
- **Phase 4: Extensibility and platform maturity** — ~55% complete
  - done: runtime and deployment lifecycle seams exist, basic domain boundaries are in place, worker runtime execution plus runtime-health inspection now share an adapter/factory seam instead of hard-wiring bootstrap reconciliation to Docker, worker ingress management now also goes through an explicit seam instead of naming `CaddyService` directly, lifecycle event emission now depends on an event-sink seam instead of a raw webhook-emitter function, archive upload request/auth logic now goes through a dedicated provider seam instead of living inside deployment state management, that archive upload request/auth layer is now further split into provider-specific `http`/`s3`/`gcs`/`azure` adapters behind a registry-driven selector instead of one branching class, deployment-log archive encoding/compression now also goes through a dedicated archive-builder seam instead of living inline inside the state service, worker outbound HTTP transport now also goes through a shared client seam instead of letting Caddy route updates, lifecycle webhooks, archive uploads, and GCS token exchange each hand-roll their own timeout and fetch logic, worker shell command execution now goes through a deployment-command-runner seam instead of living inline inside runtime orchestration, worker container/network lifecycle now also goes through a runtime-manager seam instead of binding `DeploymentRunner` straight to `dockerode`, worker workspace preparation/cleanup now goes through a workspace-manager seam instead of living inline inside runtime orchestration, build-file repository inspection now goes through a repository-file-inspector seam instead of letting Dockerfile detection shell out to git directly, local archive file handling now also goes through a deployment-log-archive-store seam instead of living inline inside deployment state management, build-system resolution now also goes through a dedicated resolver seam instead of letting `DeploymentRunner` call a static detector registry directly, the default build-detector list now also goes through a dedicated detector factory instead of being hard-wired inline inside the configured resolver, raw process-launch behavior for repository inspection and shell deployment commands now also goes through a shared exec-file runner seam instead of naming `execFile` separately inside each adapter, repository clone plus image-build orchestration now also goes through a deployment-image-builder seam instead of living inline inside `DeploymentRunner`, archive upload transport/retry behavior now also goes through a deployment-log-archive-uploader seam instead of living inline inside deployment state management, worker deployment-state construction now also goes through a factory seam instead of being named directly in the job processor and bootstrap composition roots, BullMQ deployment-worker construction now also goes through a dedicated factory seam instead of being hard-wired inline at the worker module boundary, worker background-scheduler plus heartbeat-Redis construction now also goes through a dedicated factory seam instead of being wired inline in the bootstrap entrypoint, deployment-state repository construction now also goes through a dedicated factory seam instead of being named directly inside state-service composition, deployment-state database-queryable / `pg` pool construction now also goes through a dedicated factory seam instead of living inline inside the repository, deployment-runner construction now also goes through a dedicated factory seam instead of being named directly inside the Docker runtime executor, deployment-job-processor default dependency wiring now also goes through a dedicated factory seam instead of naming runtime/state/ingress/event/logger defaults inline inside the processor module, deployment-state-service default repository/ingress/archive collaborator wiring now also goes through a dedicated factory seam instead of being named inline inside the service constructor, Docker client construction now also goes through a shared factory seam instead of being named directly inside the Docker-backed runtime manager and inspector adapters, and duplicated worker runtime-family selection now also goes through a shared resolver seam instead of being repeated inline across the runtime executor, runtime inspector, and container-runtime-manager factories
  - left (~45%): broader auth/user model evolution, runtime adapter expansion, advanced day-2 operational tooling

## Implementation Log

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

- [~] Static checks attempted in current environment
- [ ] End-to-end compose validation (blocked by missing Docker CLI in this environment)
- [ ] Typecheck/test execution with installed dependencies (blocked by npm registry restrictions in this environment)

---

## Immediate Next Recommended Steps

1. Add provider-native SDK/signing integrations for S3/GCS/Azure.
