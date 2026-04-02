# Onboarding, Tutorial & Tooltip System — Implementation Plan

## Problem Statement

New Vcloudrunner users register, sign in, and land on an empty `/projects` page with a single line: "Create your first project to start deployments." There is no guided flow, no feature discovery, no tooltips, and no progressive disclosure. Non-power-users have no way to learn the platform's capabilities (multi-service composition, health checks, managed databases, environment import/export, domain management, log streaming) without reading the README or experimenting blindly.

## Design Principles

1. **Non-intrusive by default.** Onboarding should guide, not block. Users can dismiss, skip, or ignore any guidance at any time.
2. **Progressive disclosure.** Surface help at the moment it becomes relevant — don't front-load a 12-step wizard.
3. **Persistent but not permanent.** Track what the user has seen/completed so guidance doesn't repeat, but allow users to re-trigger tours from settings.
4. **Server-first compatibility.** The dashboard is predominantly Server Components. Onboarding overlays must be client components that compose cleanly alongside server-rendered content.
5. **Lean dependencies.** Prefer building on existing primitives (shadcn/ui patterns, Radix, Tailwind animations) over heavy third-party tour libraries.
6. **Accessible.** All guidance must be keyboard-navigable, screen-reader-friendly, and respect `prefers-reduced-motion`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OnboardingProvider                    │
│  (React Context — wraps layout.tsx, client component)   │
│                                                         │
│  State:  onboardingProfile (from localStorage + API)    │
│  Actions: markStepComplete, dismissTour, resetTours     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Guided Tour │  │ Contextual   │  │  Feature      │  │
│  │  Spotlight   │  │ Tooltips     │  │  Hints        │  │
│  │              │  │              │  │               │  │
│  │  Multi-step  │  │ Hover / ?    │  │  Inline cards │  │
│  │  overlay     │  │ icon tips    │  │  in empty     │  │
│  │  with focus  │  │ on controls  │  │  states       │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│  Persistence: localStorage (immediate)                  │
│               + PATCH /v1/auth/me/preferences (sync)    │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation — Tooltip Primitive & Onboarding State

**Goal:** Establish the infrastructure that all subsequent phases build on.

### 1.1 — Add Tooltip UI Primitive

- Install `@radix-ui/react-tooltip`
- Create `apps/dashboard/components/ui/tooltip.tsx` following shadcn/ui conventions
- Exports: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`
- Dark-theme styling consistent with existing design tokens (`bg-popover`, `text-popover-foreground`, `border`)
- Wrap `layout.tsx` children with `<TooltipProvider delayDuration={300}>`

### 1.2 — Add Contextual Help Icon Component

- Create `apps/dashboard/components/help-tip.tsx` — a `(?)` icon button that triggers a tooltip
- Props: `label: string`, `side?: 'top' | 'right' | 'bottom' | 'left'`, optional `learnMoreHref?: string`
- Uses Lucide `HelpCircle` icon (already available), renders as `TooltipTrigger`
- Accessible: `aria-label`, keyboard-focusable, respects motion preferences

### 1.3 — Onboarding State Provider

- Create `apps/dashboard/lib/onboarding/onboarding-context.tsx`
  ```ts
  interface OnboardingProfile {
    completedSteps: string[]       // e.g. ['welcome', 'first-project', 'first-deploy']
    dismissedTours: string[]       // e.g. ['project-settings-tour']
    tooltipsDismissed: string[]    // individually dismissed contextual tips
    firstSeenAt: string            // ISO timestamp
  }
  ```
- `OnboardingProvider` (client component) wraps `layout.tsx` children
- Reads initial state from `localStorage('vcloudrunner_onboarding')`
- Exposes: `profile`, `markStepComplete(step)`, `dismissTour(tour)`, `dismissTooltip(id)`, `resetAll()`
- Sync writes to localStorage immediately; optional background sync to API (Phase 5)

### 1.4 — Onboarding Step Registry

- Create `apps/dashboard/lib/onboarding/steps.ts`
- Central registry of all onboarding steps, tours, and contextual tips with metadata:
  ```ts
  interface OnboardingStep {
    id: string
    title: string
    description: string
    trigger: 'auto' | 'manual'       // auto = show when conditions met, manual = user-initiated
    route?: string                    // route where this step appears
    prerequisite?: string             // step ID that must be completed first
    targetSelector?: string           // CSS selector for spotlight target
  }
  ```
- Enables adding/removing steps without touching component code

**Files created:**
- `apps/dashboard/components/ui/tooltip.tsx`
- `apps/dashboard/components/help-tip.tsx`
- `apps/dashboard/lib/onboarding/onboarding-context.tsx`
- `apps/dashboard/lib/onboarding/steps.ts`

**Files modified:**
- `apps/dashboard/package.json` — add `@radix-ui/react-tooltip`
- `apps/dashboard/app/layout.tsx` — wrap with `TooltipProvider` + `OnboardingProvider`

---

## Phase 2: Welcome Flow & First-Project Guidance

**Goal:** Guide new users from registration through first project creation.

### 2.1 — Welcome Banner

- Create `apps/dashboard/components/onboarding/welcome-banner.tsx`
- Shown on `/projects` for users with `completedSteps` empty
- Card with: welcome message, 3–4 sentence platform summary, "Get Started" CTA, "Dismiss" secondary action
- Clicking "Get Started" scrolls to / opens the project create panel
- Marks `welcome` step complete on dismiss or CTA click
- Visually consistent with existing `Card` + `Badge` patterns

### 2.2 — Enhanced Empty States

Augment existing `EmptyState` instances with onboarding-aware content:

| Location | Enhancement |
|---|---|
| `/projects` (no projects) | Add numbered mini-guide: 1) Create project 2) Add env vars 3) Deploy |
| `/projects/[id]/deployments` (no deployments) | Add "Deploy your first service" CTA with brief explanation |
| `/projects/[id]/environment` (no vars) | Add tip about `.env` import and explain what env vars are used for |
| `/projects/[id]/databases` (no databases) | Explain managed Postgres, link to setup prerequisites |
| `/projects/[id]/domains` | Explain custom domain flow briefly |

- Each enhanced section is collapsible / dismissible via onboarding state
- Uses a new `GuidanceCard` sub-component inside `EmptyState` when the user hasn't completed that step

### 2.3 — Project Create Form Inline Help

Add `HelpTip` tooltips to the project creation form fields:

| Field | Tooltip |
|---|---|
| Project Name | "A human-readable name for your project. A URL-safe slug will be generated automatically." |
| Repository URL | "The Git repository to clone and build. Must be accessible from the server (HTTPS recommended)." |
| Default Branch | "The branch to build from. Defaults to 'main' if left blank." |

**Files created:**
- `apps/dashboard/components/onboarding/welcome-banner.tsx`
- `apps/dashboard/components/onboarding/guidance-card.tsx`

**Files modified:**
- `apps/dashboard/components/empty-state.tsx` — accept optional `guidance` slot
- `apps/dashboard/components/project-create-form.tsx` — add `HelpTip` instances
- `apps/dashboard/app/projects/page.tsx` — render `WelcomeBanner`
- Various project sub-pages — add enhanced empty state guidance

---

## Phase 3: Guided Tour Spotlight System

**Goal:** Build a reusable multi-step tour engine and deploy the first tour ("Project Setup Tour").

### 3.1 — Tour Spotlight Component

- Create `apps/dashboard/components/onboarding/tour-spotlight.tsx`
- A portal-based overlay that:
  - Highlights a target element (via CSS selector or ref) with a transparent cutout in a dimmed overlay
  - Shows a popover card next to the target with: step title, description, step counter (e.g. "2 of 5"), "Next" / "Back" / "Skip tour" actions
  - Smoothly scrolls the target into view
  - Traps focus within the popover for accessibility
  - Supports positioning: auto-detect best placement, manual override
  - Animates transitions between steps: overlay morph + popover slide (via `tailwindcss-animate` classes, no extra deps)

### 3.2 — Tour Engine Hook

- Create `apps/dashboard/lib/onboarding/use-tour.ts`
  ```ts
  function useTour(tourId: string, steps: TourStep[]): {
    isActive: boolean
    currentStep: number
    start: () => void
    next: () => void
    back: () => void
    skip: () => void
    complete: () => void
  }
  ```
- Integrates with `OnboardingProvider` to check dismissed/completed state
- Handles step navigation, auto-scroll, and completion tracking
- Tour auto-starts if `trigger: 'auto'` and user hasn't dismissed/completed it

### 3.3 — Project Setup Tour (First Tour)

A 5-step tour that activates after the user creates their first project and lands on the project detail page:

| Step | Target | Content |
|---|---|---|
| 1 | Project subnav tabs | "These tabs let you manage deployments, environment variables, logs, databases, domains, and project settings." |
| 2 | Deploy button / deploy section | "Hit Deploy to build and run your project from Git. You can also deploy all services at once." |
| 3 | Environment tab | "Add environment variables your app needs at runtime. You can bulk-import a .env file too." |
| 4 | Settings tab | "Configure per-service health checks, restart policies, and resource limits here." |
| 5 | Sidebar status link | "Check the Status page anytime to see if the API, queue, and worker are healthy." |

- Auto-triggers on first visit to `/projects/[id]` after project creation (gated by `first-project-created` step completion + `project-setup-tour` not dismissed)
- On completion, marks `project-setup-tour` complete

### 3.4 — Re-trigger Tours from Settings

- Add a "Tours & Guidance" section to `/settings` page
- Shows completed/available tours with a "Replay" button
- "Reset all onboarding" link that calls `resetAll()` on the onboarding provider

**Files created:**
- `apps/dashboard/components/onboarding/tour-spotlight.tsx`
- `apps/dashboard/components/onboarding/tour-popover.tsx`
- `apps/dashboard/lib/onboarding/use-tour.ts`

**Files modified:**
- `apps/dashboard/app/projects/[id]/page.tsx` — mount project setup tour
- `apps/dashboard/app/settings/page.tsx` — add tours/guidance management section

---

## Phase 4: Contextual Tooltips Across the Platform

**Goal:** Add targeted help tooltips to complex controls and less-obvious features.

### 4.1 — Service Editor Tooltips

| Control | Tooltip |
|---|---|
| Service Kind (web/worker) | "Web services receive HTTP traffic. Worker services run background tasks without a public endpoint." |
| Exposure (public/internal) | "Public services get an external URL. Internal services are only reachable by other services in the same project." |
| Container Port | "The port your application listens on inside the container." |
| Memory MB | "Maximum memory allocation for this service container." |
| Health Check Command | "A shell command to probe service health (e.g. 'curl -f http://localhost:3000/health'). The container is marked unhealthy after consecutive failures." |
| Health Check Interval | "Time between health check probes." |
| Health Check Retries | "Number of consecutive failures before the container is considered unhealthy." |
| Restart Policy | "'always' restarts on any exit. 'on-failure' only restarts on non-zero exit codes. 'unless-stopped' restarts unless explicitly stopped." |

### 4.2 — Deployment Page Tooltips

| Control | Tooltip |
|---|---|
| Redeploy button | "Re-runs the deployment with the same Git ref and configuration. Useful after pushing new commits." |
| Rollback button | "Reverts to the exact build artifact and config from this deployment." |
| Deployment status badge | "queued → building → running. Deployments can be cancelled while queued or building." |

### 4.3 — Environment Page Tooltips

| Control | Tooltip |
|---|---|
| Import button | "Paste or upload a .env file to bulk-import variables. Existing keys will be overwritten." |
| Export button | "Download all environment variables as a .env file." |
| Masked value | "Click to reveal. Values are encrypted at rest." |

### 4.4 — Domain Management Tooltips

| Control | Tooltip |
|---|---|
| Add Domain | "Add a custom domain for your project. You'll need to add a TXT record to verify ownership." |
| Verify button | "Triggers a DNS lookup to check if the TXT record exists." |
| TLS status indicators | "Green = valid TLS with trusted certificate chain. Yellow = certificate issues detected." |

### 4.5 — Token Management Tooltips

| Control | Tooltip |
|---|---|
| Scopes checkboxes | "Restrict what this token can access. Read scopes allow fetching data; write scopes allow mutations." |
| Rotate button | "Generates a new token value and revokes the old one. Connected integrations will need the new token." |
| Expiration field | "Optional. Tokens without an expiration remain valid until manually revoked." |

**Files modified (all are existing components):**
- `apps/dashboard/app/projects/[id]/settings/service-editor.tsx`
- `apps/dashboard/app/deployments/[id]/page.tsx`
- `apps/dashboard/app/projects/[id]/environment/page.tsx`
- `apps/dashboard/app/projects/[id]/domains/_components/*.tsx`
- `apps/dashboard/components/token-management-page.tsx`
- Various other page/component files

---

## Phase 5: First-Deploy Celebration & Progressive Feature Discovery

**Goal:** Reward milestones and surface advanced features at the right moment.

### 5.1 — Milestone Celebration Toasts

Trigger celebratory `sonner` toasts at key moments:

| Milestone | Message |
|---|---|
| First project created | "Project created! Let's set it up for deployment." |
| First deployment running | "Your first deployment is live! 🎉" |
| First custom domain verified | "Domain verified — your app is now reachable at your custom domain." |
| First managed database provisioned | "Database provisioned. Connection credentials have been injected into your service environment." |

- Toasts are one-time (gated by onboarding step completion)
- Use existing `sonner` toast infrastructure — no new dependencies

### 5.2 — Feature Discovery Hints

After key milestones, show inline hint cards that surface advanced features the user might not know about:

| Trigger | Hint |
|---|---|
| After first successful deployment | Card on project page: "Did you know? You can configure health checks and restart policies in Settings → Services." |
| After adding 3+ env vars manually | Card on env page: "Tip: You can import all your variables at once from a .env file." |
| After first deployment fails | Card on deployment detail: "Check the logs below for error details. Common causes: missing env vars, invalid Dockerfile path, or Git access issues." |
| After creating 2+ projects | Sidebar hint: "Use the Status page to monitor all your deployments at a glance." |

- Each hint has a "Got it" dismiss action and a "Learn more" link (if applicable)
- Hints render as a `GuidanceCard` component (from Phase 2) positioned contextually
- Dismissed via onboarding state; never re-shown

### 5.3 — Server-Side Preference Sync (Optional)

- Add `preferences` JSONB column to `users` table (migration)
- `PATCH /v1/auth/me/preferences` endpoint to persist onboarding state server-side
- `OnboardingProvider` syncs localStorage → API on write (debounced, fire-and-forget)
- On sign-in, merge server state into localStorage (server wins for `completedSteps`, localStorage wins for `dismissedTours` to avoid re-showing dismissed items)
- This enables onboarding state to follow users across devices/browsers

**Files created:**
- `apps/dashboard/components/onboarding/milestone-toast.tsx`
- `apps/dashboard/components/onboarding/feature-hint.tsx`

**Files modified:**
- `apps/dashboard/app/projects/[id]/page.tsx` — mount feature hints
- `apps/dashboard/app/projects/[id]/environment/page.tsx` — mount env import hint
- `apps/dashboard/app/deployments/[id]/page.tsx` — mount failure guidance hint
- `apps/api/src/db/schema.ts` — add `preferences` column (Phase 5.3 only)
- `apps/api/src/modules/auth/` — add preferences endpoint (Phase 5.3 only)
- `apps/dashboard/lib/onboarding/onboarding-context.tsx` — add API sync (Phase 5.3 only)

---

## Phase 6: Keyboard Shortcuts & Command Palette Help

**Goal:** Power-user discoverability without cluttering the UI.

### 6.1 — Keyboard Shortcut Overlay

- Create `apps/dashboard/components/onboarding/keyboard-shortcuts.tsx`
- Activated by pressing `?` (when not focused on an input)
- Shows a dialog with available keyboard shortcuts grouped by section
- Initial shortcuts:
  - `?` — Show this help
  - `g p` — Go to Projects
  - `g d` — Go to Deployments
  - `g s` — Go to Status
  - `g t` — Go to Settings
  - `Esc` — Close dialog / dismiss tour

### 6.2 — Help Menu in Sidebar

- Add a "Help" item at the bottom of the sidebar (Lucide `LifeBuoy` icon)
- Dropdown or popover with:
  - "Keyboard shortcuts" — triggers shortcut overlay
  - "Replay setup tour" — restarts the project setup tour
  - "Reset all tips" — resets onboarding state
  - "Documentation" — external link to README / docs (when hosted)

**Files created:**
- `apps/dashboard/components/onboarding/keyboard-shortcuts.tsx`
- `apps/dashboard/lib/onboarding/use-keyboard-shortcuts.ts`

**Files modified:**
- `apps/dashboard/components/sidebar.tsx` — add Help menu item
- `apps/dashboard/app/layout.tsx` — mount keyboard shortcut listener

---

## Implementation Order & Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
  │                        │
  │                        ▼
  │                     Phase 6
  │
  └──────► Phase 5 (can run in parallel with 3/4)
```

| Phase | Estimated Scope | Dependencies |
|---|---|---|
| **Phase 1** — Foundation | ~8 files, 1 new dep | None |
| **Phase 2** — Welcome & Guidance | ~6 files | Phase 1 |
| **Phase 3** — Tour Spotlight | ~5 files | Phase 1 |
| **Phase 4** — Contextual Tooltips | ~10 files (mostly edits) | Phase 1 |
| **Phase 5** — Milestones & Hints | ~4 files + optional migration | Phase 1, Phase 2 |
| **Phase 6** — Keyboard & Help Menu | ~4 files | Phase 1 |

---

## New Dependency Budget

| Package | Purpose | Size |
|---|---|---|
| `@radix-ui/react-tooltip` | Accessible tooltip primitive | ~5 KB gzipped |

No other new dependencies. The tour spotlight, keyboard shortcuts, and onboarding state are all built on existing primitives (Radix, Tailwind, React Context, localStorage).

---

## Testing Strategy

- **Unit tests** for onboarding state logic: step completion, dismissal, reset, merge behavior (vitest, already configured)
- **Unit tests** for tour engine hook: step navigation, boundary conditions, auto-start gating
- **Component tests** for tooltip rendering, tour spotlight positioning, keyboard shortcut registration
- **Manual E2E validation**: fresh registration → full onboarding flow through all milestones
- **Regression**: existing empty states still render correctly when onboarding is dismissed/completed

---

## Accessibility Checklist

- [ ] All tooltips announced by screen readers (`role="tooltip"`, `aria-describedby`)
- [ ] Tour spotlight traps focus, `Escape` dismisses, `Tab` cycles through popover actions
- [ ] Keyboard shortcuts don't fire when focus is in form inputs
- [ ] Tour overlay respects `prefers-reduced-motion` (skip animations, instant transitions)
- [ ] Welcome banner and guidance cards are semantically `role="status"` or `role="complementary"`
- [ ] All dismiss/skip actions are keyboard-accessible
- [ ] Color contrast meets WCAG AA for all tooltip and tour text

---

## File Tree Summary (New Files)

```
apps/dashboard/
  components/
    ui/
      tooltip.tsx                          ← Phase 1
    help-tip.tsx                           ← Phase 1
    onboarding/
      welcome-banner.tsx                   ← Phase 2
      guidance-card.tsx                    ← Phase 2
      tour-spotlight.tsx                   ← Phase 3
      tour-popover.tsx                     ← Phase 3
      milestone-toast.tsx                  ← Phase 5
      feature-hint.tsx                     ← Phase 5
      keyboard-shortcuts.tsx               ← Phase 6
  lib/
    onboarding/
      onboarding-context.tsx               ← Phase 1
      steps.ts                             ← Phase 1
      use-tour.ts                          ← Phase 3
      use-keyboard-shortcuts.ts            ← Phase 6
```
