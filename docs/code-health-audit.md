# Vcloudrunner Code Health Audit

Date: 2026-03-30

## Scope

This audit examines code health, dead code, duplicate logic, overengineering, refactoring needs,
and feature richness across the full codebase — API, Worker, Dashboard, and shared-types.
It intentionally avoids restating items already covered by `roadmap.md` or `progress.md`.

---

## 1. God-Class / File Size Hotspots

These files have grown far beyond the point where they can be read, reviewed, or tested as a unit.

| File | Lines | Bytes | Problem |
|------|------:|------:|---------|
| `apps/api/src/modules/projects/projects.service.ts` | **3 854** | 146 KB | Handles project CRUD, domain CRUD, domain diagnostics derivation (cert validity, trust, chain, identity, attention, chain-history, path-validity, freshness, claim workflow), membership, invitations, invitation delivery, project deletion. At least 5 distinct bounded contexts live in one class. |
| `apps/dashboard/app/projects/[id]/domains/page.tsx` | **1 574** | 75 KB | A single RSC page file containing 30+ local derivation functions, 40+ local counter variables, hundreds of lines of inline badge/card/summary logic for every certificate sub-domain. Should be decomposed into components. |
| `apps/api/src/modules/project-databases/project-databases.service.ts` | — | 66 KB | Similar pattern: backup artifacts, restore requests, operations, event history, provisioning, credential rotation, and health all live in one service. |
| `apps/api/src/modules/projects/projects.repository.ts` | — | 53 KB | Houses every query for projects, domains, domain events, memberships, invitations, invitation claims. |
| `apps/dashboard/lib/api.ts` | — | 40 KB | Growing fetch wrapper for every API surface (projects, deployments, domains, databases, tokens, auth, members, invitations). |
| `apps/api/src/services/project-domain-diagnostics.service.ts` | — | 25 KB | TLS inspection, DNS resolution, cert parsing, chain capture, verification-token matching — many independent responsibilities. |
| `apps/dashboard/lib/project-domains.ts` | — | 21 KB | Badge-variant/label mapping for every certificate sub-status. Purely presentational logic that could be auto-derived from status enums. |

### Suggestion

Split `projects.service.ts` into at least:
- `ProjectCrudService` (CRUD, slug, services)
- `ProjectDomainService` (domain claims, diagnostics derivation, route status)
- `ProjectMembershipService` (members, invitations, delivery)
- `ProjectDeletionService` (teardown, route deactivation)

Same pattern applies to `project-databases.service.ts` → separate backup/restore, health, provisioning, audit concerns.

Split `domains/page.tsx` into sub-components (`DomainSummaryCard`, `DomainCertificateDetail`, `DomainClaimGuide`, etc.) and move the 40+ counter variables into a single `useDomainsSummary(domains)` derivation.

---

## 2. Worker Factory Overengineering

**The worker has 218 `.ts` files vs the API's 77, despite having a much narrower domain (process a deployment job).**

The Phase 4 decomposition drove the worker toward an extreme factory-per-seam pattern:

```
interface Foo                   (4-18 lines)
├── foo.factory.ts              (factory taking deps → Foo)
├── foo.factory.test.ts         (tests the factory wiring)
├── configured-foo.factory.ts   (factory reading env → Foo)
├── configured-foo.factory.test.ts
├── some-foo.ts                 (the only implementation)
└── some-foo.test.ts
```

This 6-file pattern is repeated for **every** seam — including seams with a single implementation that will likely never have a second one on a single-node platform:

| Seam | Interface lines | Implementations | Files (incl. tests) |
|------|---------------:|:---------:|----------:|
| `RuntimeInspector` | 4 | 1 (Docker) | 6 |
| `IngressManager` | 5 | 1 (Caddy) | 5 |
| `DeploymentEventSink` | 6 | 1 (webhook) | 6 |
| `DeploymentCommandRunner` | 15 | 1 (shell) | 6 |
| `DeploymentWorkspaceManager` | 18 | 1 (local fs) | 6 |
| `RepositoryFileInspector` | 4 | 1 (git) | 6 |
| `DeploymentLogArchiveBuilder` | 5 | 1 (gzip-ndjson) | 7 |

The `archive-upload/` directory alone has **40 files** for 4 upload providers, with shared, registry, factory, configured-factory, and per-provider client-factory layers.

### What this costs

- **Cognitive load**: finding where real logic lives requires traversing 3-4 indirection layers.
- **Maintenance tax**: renaming a method touches 6 files minimum.
- **Test bloat**: factory-wiring tests (`factory.test.ts`) typically assert "it calls `new Foo(bar)`" — they test wiring, not behavior.
- **False seam safety**: the guardrail (roadmap rule) explicitly says to prefer simpler single-node paths. These factories prepare for multi-implementation scenarios that the product guardrail says to defer.

### Suggestion

For seams with exactly one implementation that is not projected for a second one in the single-node scope:
1. **Collapse interface + factory + configured-factory into a single file** that exports both the type and a `create*()` function.
2. **Delete factory-wiring tests** that only verify constructor arguments — test the real implementation instead.
3. Keep the current depth only for seams where a second implementation is realistically near-term (e.g., `archive-upload` providers if the registry actually switches at runtime).

Conservative estimate: **~80 files** (40 factories + 40 factory tests) could be collapsed.

---

## 3. Dead Code

| Item | Location | Evidence |
|------|----------|----------|
| `page.tsx.bak` | `apps/dashboard/app/page.tsx.bak` | Backup file checked into the repo. Imports `mockProjects` and `mockDeployments`. Should be deleted. |
| `mock-data.ts` usage in production pages | `apps/dashboard/app/deployments/page.tsx` imports `mockDeployments`; `apps/dashboard/app/projects/page.tsx` imports `mockProjects` | These are real page routes still importing hardcoded mock data as fallbacks. The mock-data module itself should be deleted and remaining references replaced with empty-state handling. |
| `.tmp-poll-deploy.js`, `.tmp-seed-user.js`, `.tmp-trigger-and-poll.js` | repo root | Scratch/utility scripts at root level. Should be moved to a `scripts/` directory or deleted. |
| `.gitkeep` | repo root | Empty file with no enclosing directory purpose — likely vestigial. |
| `.tmp/` directory | repo root | Temporary directory checked into the repo. |

### Suggestion

Delete `page.tsx.bak`, the root `.tmp*` scripts, `.gitkeep`, and the `.tmp/` directory. Audit `mock-data.ts` references and replace with real empty-state fallbacks.

---

## 4. Duplicate / Near-Duplicate Logic

### 4a. `auth-utils.ts` — four project-access functions with identical structure

`ensureProjectMembershipManagementAccess`, `ensureProjectOwnershipTransferAccess`, `ensureProjectDeletionAccess`, and `ensureProjectAccess` all follow the same pattern:

```
1. Fetch project by ID
2. If null → throw ProjectNotFoundError
3. If actor.role === 'admin' || project.userId === actor.userId → return project
4. Check membership
5. If no membership → throw ForbiddenProjectAccessError
6. If membership role insufficient → throw specific error
```

Only step 6 differs. These should be consolidated into a single `ensureProjectRoleAccess(projectsService, input, { requiredRole, forbiddenError })` or a policy-based matcher.

### 4b. Dashboard status-code → error-message mapping

`helpers.ts` contains at least **5 functions** that map HTTP status codes to error messages with near-identical `if (statusCode === 401) ... if (statusCode === 403) ...` chains:

- `createProjectErrorReason`
- `createDeploymentErrorMessage`
- `createEnvironmentVariableActionErrorMessage`
- `describeDashboardLiveDataFailure`
- `describeDashboardProxyFailure`

Each hard-codes the same status → meaning mapping with slightly different wording. These should use a shared `classifyApiError(statusCode)` helper that returns a structured error-kind, with the per-feature message composed from that kind.

### 4c. Fingerprint truncation — duplicated

`formatProjectDomainCertificateFingerprintPreview` in `projects.service.ts` (lines 629-635) and `formatCertificateFingerprint` in `domains/page.tsx` (lines 328-338) do the same thing with slightly different truncation widths. Consolidate or share through `project-domains.ts`.

### 4d. Domain diagnostics derivation — split across API and dashboard

Certificate validity, trust, chain, attention, and history derivation logic is partly in `projects.service.ts` (the authoritative derivation), and partly re-derived in `project-domains.ts` and `domains/page.tsx` (the display side). The display functions duplicate status-check predicates that already exist on the API. Consider having the API return fully derived display-ready contracts instead of making the dashboard re-interpret raw status enums.

---

## 5. Mixed Line Endings

`shared-types/src/index.ts` has mixed CRLF (lines 160-163, 165-186) and LF (lines 1-159) line endings. The same pattern appears in `auth-utils.ts` and `helpers.ts`. This causes noisy diffs and suggests inconsistent editor settings.

### Suggestion

Add a root `.editorconfig` and/or `.gitattributes` rule to enforce consistent line endings. Run a one-time normalization pass.

---

## 6. Architectural Smells

### 6a. `projects.repository.ts` — combined query surface

At 53 KB, this repository handles projects, domains, domain events, memberships, and invitation records. This makes it impossible to test or reason about project CRUD independently from domain diagnostics persistence.

**Suggestion:** Split into `ProjectsRepository`, `ProjectDomainsRepository`, `ProjectMembershipsRepository`.

### 6b. Dashboard `api.ts` — monolithic fetch module

At 40 KB, this single file is the only fetch abstraction for the entire dashboard. Every new API surface adds more functions here. It should be split by domain (e.g., `api/projects.ts`, `api/deployments.ts`, `api/domains.ts`, `api/databases.ts`).

### 6c. Deployment job processor test file

`apps/worker/src/workers/deployment-job-processor.test.ts` is **40 KB** — one of the largest test files. Tests this large are hard to navigate and maintain. Consider splitting by scenario family (happy path, cancellation, failure modes, cleanup).

### 6d. No shared error taxonomy between API and dashboard

The API uses `domain-errors.ts` with typed error classes. The dashboard uses string-based `API_REQUEST_FAILED` regex parsing in `extractApiStatusCode`. This means the dashboard can never distinguish `ProjectNotFoundError` from `DeploymentNotFoundError` — it only sees 404. A shared error-code contract in `shared-types` would make dashboard error handling more precise.

---

## 7. Testing Gaps & Opportunities

| Area | Issue |
|------|-------|
| Worker factory tests | ~40 factory test files only verify constructor wiring (`"creates X with deps"`). These add maintenance cost without testing behavior. |
| Integration / E2E | The codebase has no E2E tests. Phase 1 progress notes mention this as a known gap. Browser or Docker-compose level smoke tests would catch regressions that unit tests miss (e.g., compose startup, real deploy flow). |
| Dashboard tests | There are **zero test files** in the dashboard. Server-action logic, API helpers, and derivation functions in `helpers.ts`, `project-domains.ts`, and `project-databases.ts` are all untested. |
| `project-domain-diagnostics.service.test.ts` → `project-domain-diagnostics-refresh.service.test.ts` boundary | The refresh service is tested, but the integration between the two services (refresh triggering diagnostics, which triggers persistence, which triggers event emission) is only exercised end-to-end if you run the full server. |

### Suggestion

Prioritize adding tests for dashboard derivation logic (`project-domains.ts`, `helpers.ts`) — these are pure functions and trivially testable. Delete or collapse the ~40 factory-wiring tests.

---

## 8. Feature Richness Assessment (Single-Node Scope)

Evaluating what the platform does well and what noticeable single-node gaps remain beyond what the roadmap already tracks:

### Strengths (for a single-node MVP)
- Deployment lifecycle is impressively resilient — best-effort teardown, cancellation invariants, orphan cleanup
- Domain/TLS observability is exceptionally deep (cert identity, chain analysis, path validity, attention history)
- Auth model has progressed well (session cookies, invitations, membership roles, ownership transfer)
- Managed Postgres groundwork is thorough (provisioning, health, credentials, backup operations, restore workflow, audit)
- Worker runtime seams exist for all key extension points (even if over-abstracted today)

### Missing single-node features not yet in roadmap

| Gap | Why it matters for single-node |
|-----|-------------------------------|
| **No deployment log search / filter** | Operators must scroll through raw log output. Even basic substring filtering would dramatically improve debugging. |
| **No deployment duration / timing metrics** | There is no way to see how long builds take or whether they are getting slower. A simple `startedAt`/`completedAt` delta displayed on the deployment detail would help. |
| **No project-level activity / audit log in the dashboard** | The API records domain events, database events, and deploy events, but there is no unified project timeline view. Operators must check each sub-page independently. |
| **No one-click redeploy** | Redeploying the same branch/commit requires navigating to the project and triggering a new deployment manually. A "Redeploy" button on the deployment detail page would reduce friction. |
| **No container resource usage visibility** | The platform tracks runtime config (memory, CPU limits) but there is no way to see actual usage. Even a simple Docker stats snapshot on the deployment detail would be valuable. |
| **No `.env` file import/export** | Environment management is key-by-key. Operators commonly want to paste or export a full `.env` file. |
| **No deployment comparison** | No way to diff env vars, branch, or config between two deployments of the same service. |
| **No health check / restart policy per service** | If a container crashes, the platform does not restart it. On single-node this is a real operator pain point. |
| **No scheduled / cron job support** | The service model supports `web` and `worker` kinds, but there is no `cron` kind for recurring tasks — a common single-node use case. |
| **No API rate-limit visibility in dashboard** | The API has rate limiting, but operators cannot see their remaining quota or adjust per-project limits. |
| **No database connection pool visibility** | Managed Postgres tracks health, but operators cannot see active connections or pool saturation — important for a single-node setup where connection limits are tight. |

---

## 9. Summary Priorities

Ordered by impact-to-effort ratio:

1. **Delete dead code** — `page.tsx.bak`, root `.tmp*` scripts, `.gitkeep`, `.tmp/` → immediate, zero risk
2. **Fix mixed line endings** — `.editorconfig` + `.gitattributes` + one normalization commit
3. **Consolidate `auth-utils.ts` access checks** — collapse 4 functions into 1 parameterized function
4. **Split `projects.service.ts`** — highest-impact refactor; the god-class is the single biggest maintainability risk
5. **Collapse worker factory chains** for single-implementation seams — ~80 files removable
6. **Split `domains/page.tsx`** into components — readability and reusability
7. **Add dashboard unit tests** for `helpers.ts` and `project-domains.ts` — pure functions, easy wins
8. **Replace `mock-data.ts` with real empty states** — production pages should not import hardcoded fixtures
9. **Split `api.ts`** — the monolithic fetch module will only keep growing
10. **Add shared error codes** to `shared-types` — enables precise dashboard error handling

---

## Non-Goals Reaffirmed

This audit deliberately does not suggest:
- Multi-node / HA architecture changes
- Abstract provider frameworks beyond proven near-term needs
- Complex plugin systems
- Any work that contradicts the product guardrail in `progress.md`

All suggestions above improve the single-node product's health, maintainability, and operator experience.
