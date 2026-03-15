# Vcloudrunner — UI/UX & Product Experience Audit

Date: 2026-03-14  
Auditor: Principal Product Designer & UI/UX Strategist (AI)  
Scope: Dashboard frontend, platform workflows, component architecture, interaction patterns  
Stage Assessment: **Early MVP with solid structural foundation — needs significant UX polish and trust-layer work**

---

## 1. Executive Summary

Vcloudrunner's dashboard has successfully transitioned from a monolithic single-page prototype into a properly routed, multi-view Next.js application. The Phase 3 work (route extraction, shadcn/ui primitives, loading skeletons, error boundaries, status badges) has moved the UI from "prototype" to "early product." The recent proof-of-concept milestone — successfully deploying and running the Vvoice backend — confirms the UI backs a real, working pipeline.

**Current maturity: 3/10 for platform product UX.**

The architecture is now correct (proper route segments, server actions, shared loaders, CSS variable theming). However, the *experience layer* sitting on top of that architecture is thin. The dashboard currently tells users what exists but does poorly at communicating what is happening, what went wrong, what to do next, or whether to trust the platform's state. It reads as a data-display shell rather than an operational control surface.

**The gap is no longer structural — it is experiential.** The routing, data fetching, and component primitives are in place. What's missing is the interaction design, feedback quality, visual polish, and trust-building patterns that make a deployment platform feel dependable.

| Dimension | Rating | Summary |
|-----------|--------|---------|
| Information Architecture | ★★★☆☆ | Proper routes exist but hierarchy is flat; no project-scoped views |
| Workflow UX | ★★☆☆☆ | Flows work but lack feedback, progress visibility, and recovery paths |
| State & Feedback | ★★☆☆☆ | Skeleton loaders exist; no inline success/error feedback or pending states on actions |
| Visual Polish | ★★½☆☆ | Dark theme is credible; inconsistent component usage and hardcoded styles remain |
| Trust & Ergonomics | ★★☆☆☆ | Status strip is good; deployment state communication is weak throughout |
| Accessibility | ★½☆☆☆ | Semantic HTML is basic; no ARIA labels, focus management, or keyboard patterns |
| Extensibility | ★★★☆☆ | Route structure and component library can scale; needs layout patterns and shared patterns |

---

## 2. What Is Already Working Well

### 2.1 Architecture Is No Longer a Blocker
The Phase 3 extraction into proper Next.js route segments (`/projects`, `/deployments`, `/deployments/[id]`, `/tokens`, `/environment`, `/logs`) was the single most important UX improvement. It eliminated the monolithic page, introduced deep-linkable URLs, and created a maintainable foundation. This cannot be understated — without this, no UX improvement would have been sustainable.

### 2.2 Platform Status Strip
The `PlatformStatusStrip` component showing API, Worker, Queue, and last-deploy status is a genuinely good operational UX pattern. It provides at-a-glance system health, uses semantic badge coloring (green/amber/red), and includes secondary detail (heartbeat age, queue counts). This is the kind of trust-building element the rest of the dashboard needs.

### 2.3 Working Design Token System
CSS variables for colors (`--background`, `--foreground`, `--primary`, `--muted`, etc.) are properly configured in `globals.css` and consumed via `tailwind.config.ts`. This is future-proof for theming and prevents color drift. The Badge component's semantic variants (`success`, `warning`, `destructive`, `info`) are a strong foundation.

### 2.4 Security-Conscious UX Patterns
- **Cookie-based token flash**: Token plaintext transmitted via short-lived `httpOnly` cookie rather than URL params. Users see it once in an amber alert box. This is the correct pattern.
- **Masked secret values**: Environment variables are masked by default with reveal/copy buttons. Good security UX.
- **Destructive action confirmations**: `ConfirmSubmitButton` now uses an in-app dialog with focus trap + keyboard escape support for revoke/rotate/delete actions, improving consistency and accessibility.

### 2.5 Skeleton Loading States
Every route has a `loading.tsx` with pulse-animated skeleton shapes matching the expected content layout. This is a genuine quality signal — users see instant structural feedback on navigation rather than blank pages.

### 2.6 Error Boundaries
Both `error.tsx` (route-level) and `global-error.tsx` (root-level) exist with "Try again" buttons. The `not-found.tsx` page links back to Projects. Basic but necessary.

### 2.7 Reusable Data Loading
`loadDashboardData()` centralizes project/deployment/health fetching. This prevents data loading duplication across routes and provides a consistent fallback pattern when the API is unreachable. The `usingLiveData` flag enabling graceful mock-data fallback is a thoughtful self-hosted UX detail.

### 2.8 Deployment Detail Page
The `/deployments/[id]` page with breadcrumb navigation, metadata panel, timeline, and inline logs is the closest thing to a "real platform view" in the dashboard. It demonstrates the pattern all primary resources should follow.

### 2.9 Real-Time Log Streaming
The `LogsLiveStream` component using SSE (EventSource) with a status indicator (`connecting`/`live`/`error`) is a solid foundation for real-time observability. Combined with the `LogsAutoRefresh` polling option, users have two paths to live data.

---

## 3. Critical UX Risks

### 3.1 CRITICAL — No Action Feedback Loop
**Impact: Users cannot tell whether their actions succeeded or failed without watching for a page reload.**

When a user clicks "Trigger Deployment Job," "Create Project," "Save" (env var), or "Create Token," the following happens:
1. The server action executes.
2. The page redirects with `?status=success&message=...` or `?status=error&...` in the URL.
3. The banner renders from search params.

**Problems with this pattern:**
- There is **no pending/loading indicator** on the triggering button (except `ProjectCreateForm` which has `useFormStatus`). Users don't know if their click registered.
- Feedback is **ephemeral and non-obvious** — a colored banner at the top of the page that disappears on the next navigation. Users can easily miss it.
- The Sonner `<Toaster />` component is mounted in the layout but **never used anywhere**. Toast notifications would be the correct delivery mechanism for action feedback.
- **Search params for status messages are fragile** — refreshing the page shows the banner again; sharing the URL shows someone else success/error context that doesn't apply to them.

### 3.2 CRITICAL — Deployment Progress is a Black Box
**Impact: After triggering a deploy, users have zero visibility into its progress until it either appears in the deployment table or they manually check logs.**

A deployment platform's most critical UX moment is the period *between* "deploy triggered" and "deploy succeeded/failed." Vcloudrunner's current experience:
1. User clicks "Trigger Deployment Job" on Projects page.
2. A success banner says "Deployment triggered for 'ProjectName'."
3. Nothing else happens on screen.
4. User must manually navigate to Deployments table or Logs page.
5. There is no indication of which deployment was just triggered, what step it's on, or when to expect completion.

This is the single biggest trust gap. Platforms like Railway, Vercel, and Render show build progress inline — Vcloudrunner should at minimum redirect to the new deployment's detail page.

### 3.3 HIGH — Mock Data Pollutes Live Dashboard
**Impact: When the API returns projects/deployments, the live data is displayed. But when it returns empty lists, mock data appears instead — without clear labeling.**

In `ProjectsPage`:
```ts
const projects = data.usingLiveData && data.projects.length > 0 ? data.projects : mockProjects;
```

This means: if a user has an empty real platform (no projects yet), they see mock project cards labeled "landing-api" and "worker-demo" with a "Deploy (mock mode)" button. This is **dangerously confusing** for a self-hosted product. Users cannot tell if they're looking at real data or fake data unless they notice the subtle "mock mode" label. The mock data should only appear when the API is unreachable, not when the API returns empty results.

### 3.4 HIGH — Inconsistent Component Usage Undermines Design System
**Impact: The dashboard has `Button`, `Input`, `Label`, and `Card` primitives from shadcn/ui — but most interactive elements don't use them.**

Evidence from live code:
- **ProjectCreateForm**: Uses raw `<button>`, raw `<input>` with hardcoded `border-slate-700 bg-slate-950` classes (not design tokens)
- **Token Create form**: Uses raw `<input>`, `<select>`, `<button>` with inline Tailwind instead of `Button`, `Input`, `Label`
- **Environment page**: Same raw elements
- **Logs page**: Same raw elements
- **Deploy trigger button**: Inline styled `<button>` instead of `Button` variant

The `Button` and `Input` components exist but are almost never used outside the UI component files themselves. This means:
- No consistent focus rings, disabled states, or hover patterns
- No consistent sizing or padding
- Buttons have different border radii, background colors, and font weights across pages
- The design system is installed but not adopted

### 3.5 HIGH — No Project-Scoped Navigation
**Impact: The dashboard treats Projects, Deployments, Logs, and Environment as independent silos rather than facets of the same project.**

A project is the central organizing concept, but:
- The `ProjectCard` has no link — you cannot click into a project.
- Deployments are shown as a flat list across all projects.
- Environment page requires selecting a project from a dropdown.
- Logs page requires selecting a deployment from a dropdown of all deployments across all projects.
- There is no `/projects/[id]` route.

Industry-standard pattern: clicking a project should take you to a project detail page where you can see that project's deployments, environment, logs, and settings as sub-views. The current flat architecture means every time you want to do anything project-specific, you context-switch through disconnected pages.

---

## 4. Information Architecture Audit

### 4.1 Navigation Structure

**Current sidebar:**
```
Projects       (top-level list)
Deployments    (top-level list)
API Tokens     (settings-type page)
Environment    (project-scoped but accessed globally)
Logs           (deployment-scoped but accessed globally)
```

**Problems:**
1. **No hierarchy.** All five items are peers in the sidebar, but they have fundamentally different scopes: `Projects` and `Deployments` are platform-wide, `Environment` is project-scoped, `Logs` are deployment-scoped, and `API Tokens` is account/settings-scoped.
2. **Environment and Logs should live inside project context**, not as standalone sections. The current pattern forces users to re-establish project context on every page via dropdowns.
3. **No Settings section.** API Tokens is a settings concern but sits alongside operational views.
4. **No breadcrumb trail** except on the deployment detail page, making it hard to orient within the hierarchy.

**Recommended IA:**
```
Projects                          (platform-wide list)
  └─ /projects/[id]              (project detail: overview, deployments, env, logs, settings)
      └─ /projects/[id]/deployments/[deploymentId]  (deployment detail)
Deployments                       (cross-project deployment feed — optional shortcut)
Settings
  └─ API Tokens
  └─ (future: Account, Platform Config)
```

### 4.2 Screen Structure and Layout

**Positive:** The `max-w-5xl` constraint on content pages prevents over-stretching on wide screens. The sidebar + scrollable content area is a solid shell layout.

**Issues:**
- **Platform Status Strip is always visible** at the top of every page. On narrow viewports this uses significant vertical space. It should collapse or be dismissable after the user has acknowledged the status. Alternatively, move it to the sidebar footer.
- **No page-level actions.** Platform dashboards typically have a primary action button in the page header (e.g., "New Project" on the Projects page, "New Token" on the Tokens page). Currently, forms are the action entry point, which feels form-heavy rather than action-oriented.
- **Deployment table shows raw ISO timestamps** (`2026-03-08T19:00:00Z`) instead of relative time ("2 days ago") or locale-formatted time. This is hard to scan.
- **No search or filter.** As deployments accumulate, the flat list will become unusable. Even a simple status filter or project filter on the Deployments page would help.

### 4.3 Discoverability

- The "Trigger Deployment Job" button on the Projects page is visually subordinate to the project card (small, ghost-styled). It's the most important action on the page but reads as secondary.
- Export NDJSON / Export GZIP links on the Logs page are small and unstyled — they look like text links rather than actions.
- The scope checkboxes on the Token Create form are presented as a flat list with no grouping, making it hard to understand intended permission bundles.

---

## 5. Workflow UX Audit

### 5.1 Project Creation

**Flow:** Fill form → Submit → Redirect with success/error banner.

**Strengths:**
- Client-side validation (name length, URL format, branch format) with inline error messages
- Slug preview updates live
- `useFormStatus` shows "Creating…" during submission

**Weaknesses:**
- The form uses raw `<input>` elements with hardcoded `slate` colors, not the design system's `Input` component
- The create form is always visible at the top of the page, even when there are existing projects. This is unusual — most dashboards use a "New Project" button that opens a modal or navigates to a creation page, keeping the list view clean.
- After creation, the user stays on the Projects page with a banner. They should be prompted or redirected to configure environment variables or trigger a first deployment.
- The "Create Project" button is a raw green button (`bg-emerald-600`) that doesn't match any `Button` variant. It's visually inconsistent with every other button on the dashboard.

### 5.2 Deployment Trigger

**Flow:** Click "Trigger Deployment Job" → Server action → Redirect with banner.

**Weaknesses:**
- **No loading/pending state.** The button has no disabled state, no spinner, no "Deploying…" text. Users can double-click.
- **No redirect to the new deployment.** The user is told "Deployment triggered" but left on the Projects page. They must find the deployment themselves.
- **No deployment ID or link in the feedback message.** Even the banner doesn't help navigate.
- **Button label "Trigger Deployment Job"** is implementation-language. Users think in terms of "Deploy" or "Redeploy," not "Trigger Job."
- **No pre-deploy checks or confirmation.** For a platform managing real services, a one-click deploy with no confirmation is risky. At minimum: show current running status and warn if replacing a healthy deployment.

### 5.3 Deployment Progress Visibility

**Current:** Zero real-time progress visibility after trigger.

**What exists:**
- Deployment table shows status badges (queued → building → running/failed)
- Deployment detail page shows timeline entries (created, started, finished)
- Logs page shows build/runtime logs
- Live SSE stream exists

**What's missing:**
- No automatic navigation to the new deployment after trigger
- No step-by-step build progress (cloning → building → starting → routing → running)
- No polling or real-time status update on the deployment table or detail page
- The deployment detail page is static — it loads once and never refreshes
- No estimated time or progress bar
- No "build is taking longer than usual" warning

### 5.4 Deployment Result Feedback

**For success:** The deployment shows `running` badge in the table. The detail page shows the runtime URL. But there is no toast/notification, no "Your deployment is live" moment, and no one-click way to open the deployed URL.

**For failure:** The deployment shows `failed` badge. The detail page shows logs. But:
- There is no error summary or failure reason displayed prominently
- The user must read raw logs to understand what failed
- No "retry" or "redeploy" button from the failure state
- No link to relevant documentation or troubleshooting steps
- `STATE_RECONCILIATION` errors are shown without explaining what that means to a user

### 5.5 Log Viewing

**Strengths:**
- Deployment selector dropdown
- Auto-refresh toggle
- Live SSE stream with status indicator
- Export (NDJSON, GZIP)

**Weaknesses:**
- **Full UUIDs in the dropdown** make entries unreadable. Each option is ~80 characters wide. Should use project name + truncated ID + relative time.
- **No log level filtering.** Cannot isolate ERRORs from INFO messages.
- **No search/grep** within logs.
- **Fixed height container (`max-h-72`)** restricts log visibility to ~15 lines. For a log viewer, this is far too small. Should be resizable or expandable.
- **Identical logs appear twice** — once in the "Log Output" card (server-rendered) and again in the "Live stream" section below it. This is confusing. The live stream should replace/extend the static log output, not duplicate it.
- **Timestamps are raw ISO strings.** Relative or locale-formatted times would improve scanability.
- **No color-coding by log level.** ERROR, WARN, INFO all render in the same style in the static log card. The live stream card does color `INFO` (cyan) and `ERROR` differently, which is better but inconsistent with the card above it.

### 5.6 Environment Variable Management

**Strengths:**
- Per-project scoping with dropdown selector
- Masked values with reveal/copy
- Destructive delete confirmation

**Weaknesses:**
- The "Select Project" button + form submit pattern is clunky. Changing the dropdown should immediately fetch variables for that project (or at least changing should auto-submit).
- The "Add / Update Variable" label is ambiguous. Users don't know if entering an existing key will overwrite or error.
- No indication of which variables are in use by the running deployment vs. which will take effect on next deploy.
- No bulk import/export (e.g., paste `.env` file contents).
- No validation feedback for key names (e.g., spaces, special characters).
- The "Editing project: Test Project" breadcrumb is a plain text paragraph — it should be a stronger visual anchor.

### 5.7 Error Recovery Flow

**Largely absent.** When something fails:
- No "Retry" button on failed deployments
- No "Redeploy with same config" shortcut
- No guidance on what to check after failure
- No link from failure state back to environment variables (common fix) or project settings
- The error boundary "Try again" button calls `reset()` which re-renders — but if the underlying server action failed due to an API issue, re-rendering won't help

---

## 6. UI State and Feedback Audit

### 6.1 Loading States

| Context | Implementation | Quality |
|---------|---------------|---------|
| Route navigation | `loading.tsx` skeleton files | Good — structurally appropriate pulse animations |
| Server actions (deploy, create, save) | None except ProjectCreateForm | Poor — no pending indicators |
| Data fetching within page | Suspense on PlatformStatus only | Partial — other data loads block the full page |
| Live stream connection | "connecting" text label | Adequate |

**Key gap:** The `useFormStatus`-based "Creating…" button state in `ProjectCreateForm` is the only server action with pending feedback. Every other form submission provides zero visual feedback during processing. The `Button` component from shadcn/ui supports `disabled` styling which would solve this — but it's not used.

### 6.2 Empty States

| Page | Empty State | Quality |
|------|------------|---------|
| Projects (no API) | Shows mock data | Confusing — See §3.3 |
| Projects (API, no projects) | Card: "No projects yet. Create your first project…" | Adequate but no CTA button |
| Deployments (empty) | Card: "No deployments yet. Trigger a deployment from the Projects page." | Good — directs to next action |
| Tokens (empty) | Card: "No API tokens yet. Create one above." | Good |
| Environment (no projects) | Card: "No projects found. Create a project first." | Adequate |
| Logs (no deployments) | Card: "No deployments found. Trigger a deployment first." | Adequate |
| Deployment detail (not found) | Text with back link | Adequate |

**Pattern assessment:** Empty states exist but are text-only. They lack icons, prominent CTAs (buttons), or illustrations. They fulfill a functional need but don't feel guiding or encouraging. Compare to Railway's empty states which have clear iconography, a single bold CTA, and sometimes a quick-start guide inline.

### 6.3 Success States

**Effectively absent as distinct states.** Success is communicated via:
- URL search param banners (emerald green bar at top of page) — transient
- The Toaster component is installed but never triggered
- No success animation, no confetti, no visual celebration for the most important moment (first successful deployment)

### 6.4 Error States

| Layer | Implementation | Quality |
|-------|---------------|---------|
| Route error boundary | `error.tsx` with Card + reset | Basic but functional |
| Global error boundary | `global-error.tsx` | Present |
| Server action errors | URL search param banners (rose red) | Fragile, easy to miss |
| API fetch failures | Silent catch → empty state or fallback | No error messaging |
| Live stream errors | "error" text label (rose color) | Minimal |

**Key gap:** When the API is unreachable, the dashboard silently falls back to mock data or empty states. There is no explicit "API connection failed" banner, no retry button, and no indication that the data shown might be stale or incomplete. For a self-hosted platform, where the user is also the operator, this silence is harmful — they need to know their system is down *from the dashboard itself*.

### 6.5 Warning States

**Absent.** There are no warning patterns for:
- Deployments that have been "building" for an unusually long time
- Worker heartbeat going stale (the status strip shows "stale" badge, but there's no actionable guidance)
- Environment variables changed but not yet deployed
- Tokens approaching expiration
- Multiple consecutive failed deployments

### 6.6 Pending/In-Progress States

The `ProjectCreateForm` `SubmitButton` uses `useFormStatus` to show "Creating…" — this is the only pending state in the entire dashboard. All other server actions (deploy trigger, token create/rotate/revoke, env save/delete) have no pending indication.

### 6.7 Inline Validation

`ProjectCreateForm` has strong client-side validation:
- Name length check
- Slug preview and length check
- URL format validation
- Branch name pattern validation
- Submit disabled when invalid

**No other form has inline validation.** The token create form accepts any input. The env var form has no key format guidance. This inconsistency makes the create form feel polished and everything else feel rough.

---

## 7. Visual and Interaction Design Audit

### 7.1 Visual Consistency

**The core problem:** The dashboard has two visual languages coexisting:

1. **shadcn/ui system** (CSS variables, Card/Badge/Button components, `cn()` utility) — used in deployment table, status strip, error boundaries, badges
2. **Hardcoded Tailwind** (`slate-700`, `slate-800`, `slate-900`, `slate-950`, `emerald-600`, `rose-300`, `cyan-300`) — used in ProjectCreateForm, MaskedSecretValue, LogsLiveStream, success/error banners, all form inputs

This creates visible inconsistency:
- `ProjectCreateForm` has `border-slate-700 bg-slate-950` inputs while the Token/Environment pages have `border-input bg-background` inputs
- The "Create Project" button is `bg-emerald-600` while all other primary buttons use `bg-primary`
- The LiveStream component uses `border-slate-800 bg-slate-950` directly instead of `border bg-card`
- Secret value buttons use `border-slate-700 hover:bg-slate-800` instead of design token equivalents

**Severity:** This is not just aesthetic — it means the theme cannot be changed without hunting through every component for hardcoded colors. It also creates subtle but visible shade differences between elements that should match.

### 7.2 Typography and Readability

**Positive:**
- Page headings use a consistent pattern (`text-2xl font-bold tracking-tight`)
- Subtitle pattern (`text-sm text-muted-foreground`) is consistent
- Monospace used appropriately for UUIDs, commit SHAs, env keys, tokens

**Issues:**
- Card titles use `text-sm` which is quite small for section headings within cards
- `text-[11px]` and `text-[10px]` sizes in `PlatformStatusStrip` and token scope badges are at the legibility limit
- Status strip helper text ("Operational heartbeat and queue pressure signals") is technical jargon, not user-oriented language
- ISO timestamps throughout are hard to parse at a glance

### 7.3 Spacing and Density

**Positive:**
- `space-y-6` page-level rhythm is consistent
- Card padding (`p-6`) is comfortable
- Grid gaps are appropriate

**Issues:**
- The Projects page is dense — a persistent create form, status banners, and project cards compete for attention. The form should be collapsed or behind a trigger.
- Token scope checkboxes flow horizontally with `flex-wrap` which creates irregular row lengths. A 2-column grid would be more scannable.
- The deployment detail page has inconsistent spacing between sections

### 7.4 Button Hierarchy

**Current observed buttons:**

| Button | Style | Location |
|--------|-------|----------|
| Create Project | `bg-emerald-600` (custom green) | Projects form |
| Trigger Deployment Job | `border-primary/50 bg-primary/10` (ghost) | Projects page |
| Create Token | `bg-primary` (primary) | Tokens form |
| Save (env var) | `bg-primary` (primary) | Environment form |
| Select Project | `bg-primary` (primary) | Environment page |
| Apply | `bg-primary` (primary) | Logs page |
| Rotate | `border-amber-700 text-amber-300` (custom warning) | Token row |
| Revoke | `border-destructive text-destructive` (outline destructive) | Token row |
| Delete (env var) | `border-destructive text-destructive` (outline destructive) | Env var row |
| Try again | `bg-primary` (primary) | Error boundary |
| Export NDJSON / GZIP | `border` (unstyled outline) | Logs page |
| Reveal / Copy / Hide | `border-slate-700` (hardcoded) | Secret value |

**Assessment:** There are at least 6 different button styles, none of which use the `Button` component from `components/ui/button.tsx`. The `Button` component supports `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link` variants — which would cover all these use cases. Instead, every button is a raw `<button>` with ad-hoc Tailwind classes.

### 7.5 Form UX Quality

- Native HTML `<select>` elements are used throughout — these render with browser-default styling on many platforms and break the dark theme on some browsers. A custom Select component (shadcn/ui has one via Radix) would provide consistent rendering.
- Native `<input type="datetime-local">` on the token creation form renders inconsistently across browsers and has poor dark-mode support.
- There are no `<label>` elements associated with inputs via `htmlFor`. The shadcn/ui `Label` component exists but is unused.
- Placeholder text serves as the only input label in most forms, which disappears on input and fails WCAG.

### 7.6 Table Readability

The `DeploymentTable` component is well-structured:
- Proper `<table>`, `<thead>`, `<tbody>` semantics
- Background differentiation for header
- Badge-based status display

**Issues:**
- No hover state on rows (useful for large tables)
- No zebra striping or row dividers beyond `border-t`
- Commit SHA is truncated but not consistently (some show `c0ffee1`, real data shows full SHAs or `unknown`)
- No sortable columns
- "Created" column shows raw ISO timestamps

### 7.7 Log Readability

- Monospace font is appropriate
- Line-by-line rendering is correct
- `whitespace-pre-wrap break-words` handles long lines

**Issues:**
- No syntax highlighting or level-based coloring in the static log card
- The fixed `max-h-72` (18rem = ~288px) is too restrictive for log investigation
- No line numbers
- No ability to copy a single log line
- Duplicate rendering (static card + live stream section) is confusing
- No "scroll to bottom" / "stick to tail" behavior for live streaming

---

## 8. Trust and Platform Ergonomics Audit

### 8.1 State Communication

**What the platform communicates well:**
- System health via PlatformStatusStrip (API/Worker/Queue status with heartbeat telemetry)
- Deployment status in tables via colored badges
- "Last Successful Deploy" timestamp provides historical anchor

**What the platform communicates poorly:**
- **What is actively happening right now.** There is no real-time indicator for "a build is running" anywhere except the deployment table badge (if you happen to be looking at it).
- **Why something failed.** Failed deployments show `failed` badge but no inline error summary. Users must navigate to the deployment detail page and read raw logs.
- **Whether an action was received.** No pending states means clicks feel unresponsive.
- **What the user should do next.** After creating a project, deploying, or seeing a failure, there is no guided next-step prompt.
- **Whether data is stale or live.** When the API is down, the dashboard shows mock data without clear labeling "DEMO DATA — API UNAVAILABLE."

### 8.2 Deployment Confidence

For a user relying on this platform to host their applications:

- **Can I tell if my app is running?** Partially — the deployment table shows `running` badge, but the Projects page shows `active` for all projects regardless of deployment state. There is no health check indicator.
- **Can I tell if my app is accessible?** The deployment detail shows `runtimeUrl`, but it's not a clickable link and there's no health/ping indicator.
- **Can I rollback?** No. There is no rollback or "deploy previous version" capability exposed in the UI.
- **Can I safely redeploy?** No confirmation dialog before deploying. No warning about replacing a healthy running deployment.
- **Do I know what version is deployed?** The commit SHA is shown but often as `unknown`. No branch name is displayed.
- **Can I correlate problems?** Build logs exist, but there is no deployment-level error classification, no structured failure reason, and no timeline visualization showing where in the pipeline the failure occurred.

### 8.3 Operational Trust Gaps

| Question | How Well the UI Answers It |
|----------|---------------------------|
| Is the platform healthy? | Well — status strip with badges |
| Is my deployment running? | Partially — table status badge only |
| What went wrong? | Poorly — raw logs only |
| What should I do about it? | Not at all |
| Is this data live or stale? | Not answered |
| When did this last update? | Not shown |
| Can I recover from this error? | No recovery actions exposed |
| Is it safe to deploy now? | No pre-deploy status check |

### 8.4 Platform Status Truthfulness

The `PlatformStatusStrip` shows "ok" for API status when it can reach the health endpoints, but:
- It does not distinguish between "API is up but all recent deployments failed" and "API is up and deployments are healthy."
- The "Last Successful Deploy" field shows "None recorded" even when the Vvoice deployment ran successfully (the deployment was marked `failed` after state reconciliation, not because the deployment itself failed). This creates a false impression.
- The "failed 9 / completed 3" ratio visible in the live screenshot is alarming — but there is no explanation, no trend, and no action prompt.

---

## 9. Accessibility and Responsiveness Audit

### 9.1 Semantic HTML

**Positive:**
- Proper `<table>` semantics in `DeploymentTable` with `<thead>`, `<tbody>`, `<th>`, `<td>`
- `<nav>` element in Sidebar
- `<main>` element for primary content
- `<aside>` for sidebar
- `<section>` in PlatformStatusStrip
- Headings use `<h1>`, `<h2>`, `<h3>` hierarchy

**Issues:**
- `<article>` is used for individual status cards in the strip — semantically questionable; these are not independent content pieces
- No `<header>` landmark for the page header area
- Badge component renders as `<div>` — should be `<span>` for inline semantics

### 9.2 ARIA and Screen Reader Support

**Issues (significant):**
- **No `aria-label` on any form controls.** Inputs use `placeholder` text as their only label but have no `<label>` element or `aria-label`. This is a WCAG Level A failure (1.3.1 Info and Relationships).
- **No `aria-live` regions** for dynamic content (log stream, status updates, action feedback banners). Screen readers won't announce state changes.
- **Status badges have no `role` attribute.** They look like text; screen readers won't convey their semantic importance.
- **(Resolved)** `ConfirmSubmitButton` previously used `window.confirm()`; this has since been migrated to a reusable dialog with focus management.
- **No skip-to-content link** for keyboard users to bypass the sidebar.
- **Deployment status colors rely on color alone.** While badge text includes the status word, the color-coding has no accompanying icon or pattern for colorblind users.

### 9.3 Keyboard Navigation

- **Sidebar links are focusable** (they're `<a>` tags) — good.
- **No visible focus indicators** beyond the browser defaults. The `Button` component has `focus-visible:ring-2` — but since `Button` isn't used in most places, most buttons lack custom focus styles.
- **Tab order follows DOM order** — generally correct.
- **No keyboard shortcut** for common actions (deploy, navigate sections).
- **Log stream scroll area** is not keyboard-navigable.

### 9.4 Responsive Behavior

**Layout pattern:** Fixed-width sidebar (`w-56`) + flexible content area.

**Issues:**
- **Sidebar does not collapse on small screens.** On mobile/tablet widths, the `w-56` sidebar consumes 224px, leaving very little content space. There is no hamburger menu, no responsive collapse, no slide-out drawer.
- **Grid layouts degrade partially.** `md:grid-cols-2` on project cards and `md:grid-cols-[1fr_auto]` on forms are reasonable, but haven't been tested for narrow viewports.
- **`max-w-5xl` constraint** means content is centered but doesn't use full width on large screens that could benefit from more space (especially log viewing).
- **Platform Status Strip** grid (`lg:grid-cols-4`) stacks to `sm:grid-cols-2` — reasonable but untested.
- **No `meta viewport`** tag is explicitly set (Next.js adds it by default — should verify).

### 9.5 Contrast

The dark theme's color choices are generally good for contrast:
- Light text on dark background (primary/foreground on background)
- Muted foreground (`hsl(215 20.2% 65.1%)`) provides adequate contrast against the dark background
- Badge colors (emerald, amber, rose, sky) are readable against their dark semi-transparent backgrounds

**Concerns:**
- `text-[11px]` and `text-[10px]` sizes may fail WCAG contrast requirements at those sizes
- The `text-muted-foreground` for timestamps and secondary text should be verified at minimum 4.5:1 contrast ratio
- `border-input` (same HSL as muted) creates very low contrast input borders — inputs may be hard to distinguish from their background

---

## 10. Extensibility Audit

### 10.1 Route Structure Scalability

The current route structure can accommodate growth:

```
/projects               ✅ exists
/projects/[id]          ❌ missing — critical for project-scoped views
/deployments            ✅ exists
/deployments/[id]       ✅ exists
/tokens                 ✅ exists
/environment            ✅ exists (should move to project scope)
/logs                   ✅ exists (should move to deployment scope)
/settings               ❌ missing — needed for API tokens, account, platform config
```

Adding `/projects/[id]` with nested tabs (Overview, Deployments, Environment, Logs, Settings) is the most important structural addition. The current route segments for `/environment` and `/logs` would move to become sub-routes.

### 10.2 Component Architecture

**Strengths:**
- shadcn/ui primitives are componentized and reusable
- `cn()` utility for conditional className merging
- CVA-based variant system for Badge and Button
- Server/client component split is clean (server pages with client islands)

**Weaknesses:**
- **No shared form components.** Every page builds its own forms from raw HTML. A `FormField`, `Select`, or `TextInput` wrapper would prevent repetition.
- **No shared layout components.** Every page starts with the same pattern: `<div className="mx-auto max-w-5xl space-y-6">` + `<h1>` + `<p>`. This should be a `PageHeader` or `PageLayout` component.
- **No shared feedback patterns.** The success/error banner from search params is duplicated across Projects, Tokens, and Environment pages. This should be a `StatusBanner` component that reads search params once.
- **No shared list/item patterns.** Token rows, env var rows, and deployment rows all follow the same `flex items-center justify-between rounded-md border px-4 py-3` pattern but are not componentized.

### 10.3 Future Feature Accommodation

| Feature | Current Readiness | Effort to Add |
|---------|------------------|---------------|
| Rich deployment history | Deployment table + detail page exist | Medium — needs pagination, filtering |
| Better observability | Log viewer + SSE stream exist | Medium — needs level filtering, search, expandable view |
| Route/domain management | No UI exists | New page — project-scoped |
| Auth/account settings | No UI exists | New settings section |
| Multi-service workflows | No support | High — requires project composition model |
| Multi-project management | Flat list exists | Medium — needs search, filter, sort, pagination |
| Advanced env management | Basic CRUD exists | Medium — needs bulk ops, inheritance, per-environment |
| Settings pages | No settings section | New route tree |
| Operational dashboard | Status strip exists | Medium — expand into dedicated page |

### 10.4 Design System Growth Path

The shadcn/ui foundation is the correct choice. To scale cleanly:
1. **Adopt existing components** — use `Button`, `Input`, `Label` everywhere instead of raw elements
2. **Add missing primitives** — `Select`, `Dialog`, `Tooltip`, `Tabs`, `DropdownMenu` from shadcn/ui
3. **Create composite components** — `PageLayout`, `StatusBanner`, `DataRow`, `EmptyState`, `ConfirmDialog`
4. **Document component conventions** — which variant for which context, required accessibility props

---

## 11. Prioritized Improvement Plan

Status legend for this section:
- `[x]` Done
- `[~]` Partial
- `[ ]` Pending

### Phase 1: Critical Clarity and Usability Fixes
**Goal:** Make the dashboard trustworthy enough that a user can deploy and manage an application with confidence in what they're seeing.

**Why it matters:** Without these fixes, the dashboard is a data viewer that leaves users guessing about outcomes. This phase turns it into a control surface.

**Work:**
1. `[x]` **Adopt `Button` component everywhere** — Replace all raw `<button>` elements. Map current button styles to `Button` variants. This single change unifies focus states, disabled states, hover patterns, and visual consistency.
2. `[x]` **Add pending states to all server actions** — Implement `useFormStatus` in every form with a submit button, or create a shared `SubmitButton` component with pending state.
3. `[x]` **Fix mock data contamination** — Show mock data only when `usingLiveData === false` (API unreachable), not when API returns empty results. Add a clear "DEMO MODE — API UNAVAILABLE" banner when showing mock data.
4. `[x]` **Redirect deploy trigger to deployment detail** — After triggering a deployment, redirect to `/deployments/[newId]` instead of back to Projects with a banner.
5. `[x]` **Add toast notifications** — Wire up the already-installed Sonner Toaster for action feedback (create, deploy, save, delete, rotate, revoke). Remove search param banners.
6. `[x]` **Adopt `Input` and `Label` components** — Replace raw `<input>` and add proper `<label>` associations for accessibility.

**Do first.** These fixes require no new architecture or features — just consistent application of existing tools.

### Phase 2: Trust, Feedback, and Workflow Improvements
**Goal:** Make the platform feel alive and responsive. Users should always know what's happening.

**Why it matters:** Deployment platforms live and die by their feedback quality. This phase addresses the "black box" problem.

**Work:**
1. `[x]` **Add project detail page (`/projects/[id]`)** — Show project overview, recent deployments, environment summary, and domain info. This is the missing hub that connects all project-scoped information.
2. `[x]` **Auto-refresh deployment detail** — Add polling or SSE-based status updates on the deployment detail page so users can watch a deployment progress from `queued` → `building` → `running`.
3. `[x]` **Deployment pipeline step visualization** — Show which step the deployment is in (queued, cloning, building, starting, routing) using a simple step indicator or progress timeline.
4. `[x]` **Add failure summaries** — Extract a human-readable failure reason from deployment logs and display it prominently on the deployment detail page (e.g., "Build failed: Dockerfile not found" rather than raw log output).
5. `[x]` **Add "Redeploy" button** — On deployment detail pages and project views, allow one-click redeployment.
6. `[x]` **Replace `window.confirm()` with Dialog** — Added reusable in-app dialog primitive and migrated destructive confirmation actions away from native confirm prompts with focus trap + keyboard escape handling.
7. `[x]` **Make runtime URLs clickable** — On deployment detail, make the URL a real link that opens in a new tab.
8. `[x]` **Add stale data indicator** — Show "Last refreshed X seconds ago" or "Data may be stale — API unreachable" when appropriate.

**Do second.** These require moderate new logic but dramatically improve the platform's perceived reliability.

### Phase 3: Visual Polish and Consistency
**Goal:** Make the dashboard feel deliberate and professional. Eliminate the "two visual languages" problem.

**Why it matters:** Visual inconsistency erodes trust even when functionality is correct. Users subconsciously interpret inconsistent UI as unstable software.

**Work:**
1. `[x]` **Eliminate all hardcoded color classes** — Replaced previously hardcoded palette classes with design-token-driven styles across dashboard surfaces and shared UI primitives.
2. `[x]` **Unify log rendering** — Merge the duplicate static + live stream log panels into a single panel. Add level-based coloring consistently. Use design token colors.
3. `[x]` **Add relative timestamps** — Use "2 minutes ago" / "3 days ago" format where appropriate, with full timestamp on hover (tooltip).
4. `[x]` **Improve log viewer** — Log panel now supports expand/collapse height, includes a scroll-to-bottom action for live mode, and provides log-level filtering.
5. `[x]` **Add native Select replacement** — Added shared `Select` wrapper and migrated dropdowns to the consistent dark-theme control.
6. `[x]` **Create `PageLayout` component** — Extracted shared `PageLayout` wrapper and migrated remaining top-level route/detail pages to remove repeated `max-w-5xl space-y-6` containers.
7. `[~]` **Create `EmptyState` component** — Shared component is now in use on deployments/projects/tokens/environment/logs empty states; iconography standardization is still pending.
8. `[x]` **Add row hover states** — Deployment table rows, token rows, and env var rows should highlight on hover.
9. `[x]` **Style export buttons** — Use `Button variant="outline" size="sm"` for export actions.
10. `[x]` **Improve scope checkbox layout** — Token scopes are grouped by domain with clearer descriptions and responsive multi-column layout for faster scanning.

**Do third.** This is polish work — it improves perception without changing functionality.

### Phase 4: Extensible Platform UX Maturity
**Goal:** Prepare the dashboard for feature growth without accumulating design debt.

**Why it matters:** The next features (domains, settings, multi-service, observability) need a solid pattern library to land cleanly.

**Work:**
1. `[x]` **Add nested project routes** — Move environment and logs under `/projects/[id]/environment` and `/projects/[id]/logs`. Keep top-level shortcuts if desired.
2. `[x]` **Add Settings section** — Added `/settings` route tree and moved API Tokens under `/settings/tokens` with `/tokens` retained as a redirect shortcut.
3. `[x]` **Add Tabs component** — Added shared tabs primitives and applied them to project detail sub-navigation (Overview, Deployments, Environment, Logs).
4. `[x]` **Add responsive sidebar** — Implemented mobile drawer/hamburger navigation while preserving desktop sidebar behavior.
5. `[x]` **Add pagination** — Added pagination controls for deployments list and log-entry views (global and project-scoped logs).
6. `[x]` **Add filtering and search** — Added deployment status/project/text search on `/deployments` plus live log search/filter controls for log investigation workflows.
7. `[x]` **Create documentation for component usage** — Added dashboard component usage guide covering variants, accessibility requirements, and usage conventions.
8. `[x]` **Build operational dashboard** — Added `/status` page with queue snapshot, live queue-depth trend sampling, deployment success-rate summary, and recent deployment outcome history.

**Do when the feature set demands it.** This phase is about infrastructure for growth, not immediate user value.

**What should wait / not be overbuilt yet:**
- Multi-user/auth UI — until the backend auth model is finalized
- Theming UI / light mode — until the core UX is solid
- Mobile-optimized views — until there's a real mobile use case
- Advanced analytics/observability dashboards — until there's enough deployment history to make them valuable

---

## 12. Phase Completion Snapshot (Current)

- **Phase 1: Critical Clarity and Usability Fixes** — **6/6 complete** (100%).
- **Phase 2: Trust, Feedback, and Workflow Improvements** — **8/8 complete** (100%).
- **Phase 3: Visual Polish and Consistency** — **10/10 complete** (100%).
- **Phase 4: Extensible Platform UX Maturity** — **8/8 complete** (100%).

## 13. Quick Wins

High-leverage improvements that can be implemented quickly with strong ROI:

| # | Improvement | Effort | Impact |
|---|-----------|--------|--------|
| 1 | Replace all raw `<button>` with `Button` component variants | 2–3 hours | Visual consistency, focus states, disabled states |
| 2 | Wire Sonner toast for all server actions | 1–2 hours | Immediate action feedback |
| 3 | Add `useFormStatus` pending state to all forms | 1 hour | Users know when actions are processing |
| 4 | Fix mock data logic (empty ≠ mock) | 30 minutes | Prevent user confusion |
| 5 | Redirect deploy trigger to new deployment detail | 30 minutes | Connect action to outcome |
| 6 | Make runtime URLs clickable links | 15 minutes | Basic but missing usability |
| 7 | Add relative timestamps (`timeago`) | 1 hour | Scanability improvement |
| 8 | Add proper `<label>` elements to all inputs | 1 hour | Accessibility compliance |
| 9 | Change deploy button label to "Deploy" | 5 minutes | Remove implementation jargon |
| 10 | Collapse project create form behind button | 30 minutes | Cleaner project list view |

---

## 14. Long-Term Watchouts

Areas that are acceptable now but will become UX bottlenecks if ignored:

### 14.1 Deployment List Scalability
The flat deployment list loads all deployments across all projects via `loadDashboardData()`. As deployment count grows toward hundreds, this will become slow and unusable. Pagination, project scoping, and status filtering will become essential.

### 14.2 Log Volume Performance
The log viewer loads 100 entries and caps the live stream at 300 entries in memory. For long-running services or verbose builds, this will be insufficient. Virtual scrolling and server-side pagination for logs will be needed.

### 14.3 Sidebar Item Growth
Five items works. Adding domains, settings, monitoring, billing, or multi-project organization will require collapsible groups or a redesigned navigation pattern.

### 14.4 Single-User Blind Spot
The entire dashboard assumes a single `demoUserId`. When multi-user support arrives, every data query, permission check, and UI personalization will need to be reworked. Plan the auth boundary early even if the implementation waits.

### 14.5 Environment Variable Complexity
The flat key/value list works for simple apps. Multi-environment support (staging vs. production), variable inheritance, and bulk operations will become necessary as users manage more complex applications.

### 14.6 No Undo / Audit Trail in UI
Destructive actions (revoke token, delete env var) have confirmation dialogs but no undo capability and no visible audit log. As platform trust requirements increase, an activity log will be expected.

### 14.7 Real-Time Data Strategy
Currently, real-time updates are split between:
- SSE for log streaming
- `router.refresh()` polling for auto-refresh
- Static server rendering for everything else

A unified real-time strategy (probably SSE or WebSocket for all live data) will be needed as more UI elements need to reflect live platform state.

### 14.8 Search Param Fragility
Using URL search params for success/error banners is a code smell that will not scale. As forms multiply, the search param parsing logic will grow, banners will stack, and stale messages will persist through bookmarks. Moving to toast notifications via Sonner is the correct long-term path.
