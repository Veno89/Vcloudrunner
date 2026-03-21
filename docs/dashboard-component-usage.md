# Dashboard Component Usage Guidelines

This guide defines how shared dashboard UI primitives should be used so new screens remain visually and behaviorally consistent.

## Layout and Structure

- Use `PageLayout` for page-level content containers instead of repeating `mx-auto max-w-5xl` wrappers.
- Use `PageHeader` for title/description blocks at the top of route content.
- Prefer `Card` + `CardHeader` + `CardContent` for grouped content sections.

## Actions and Buttons

- Use `Button` for all interactive button actions (never raw `<button>` in app/components code).
- Variant guidance:
  - `default`: primary forward actions (create/deploy/save)
  - `outline`: neutral secondary actions (refresh/export/navigation)
  - `destructive`: irreversible operations (revoke/delete)
  - `ghost`: low-emphasis icon/utility actions
- Use `FormSubmitButton` for form submissions with pending states.
- Use `ConfirmSubmitButton` for destructive form submits requiring confirmation.

## Dialogs and Destructive Confirmation

- Use shared `Dialog` rather than inline modal markup.
- For destructive confirmation flows:
  - set dialog role to `alertdialog`
  - disable overlay-dismiss via `closeOnOverlayClick={false}`
  - provide explicit cancel/confirm actions
  - provide `returnFocusRef` so focus is restored to trigger

## Form Controls and Accessibility

- Use shared `Input`, `Label`, and `Select` primitives.
- Every control must have an explicit accessible label (`<Label>` or `aria-label`).
- Keep helper text in `text-muted-foreground` styles to align with theme tokens.

## Empty, Demo, and Error States

- Use `EmptyState` for no-data states; include clear next-step copy and CTA where possible.
- Use `DemoModeBanner` whenever mock/demo data is intentionally shown.
  - Include actionable detail when the fallback reason is known (for example missing `NEXT_PUBLIC_DEMO_USER_ID` or unauthorized `API_AUTH_TOKEN`).
  - Banner copy should say live data is unavailable rather than assuming the API itself is down; missing dashboard user context and auth failures also use this path.
  - When live data is only partially available, reuse the same banner with `title="Partial outage"` so pages can keep rendering truthful partial results without pretending they are in demo mode.
- Use `LiveDataUnavailableState` for route-level live-data failures on project-scoped or settings pages when rendering real content is not possible.
- Keep platform-level health signals visible when possible even if project-scoped live data is unavailable; missing `NEXT_PUBLIC_DEMO_USER_ID` should not hide queue/worker health if those endpoints are still reachable.
- Route-level/global error views should use `Card` + shared `Button` retry action.

## Status and Feedback

- Use `Badge` variants for status semantics:
  - `success`, `warning`, `destructive`, `info`, `secondary`, `outline`
- Avoid hardcoded palette classes in component-level status indicators.
- For action outcomes, prefer `ActionToast`/toast-based feedback over persistent URL banners.

## Logs and Operational Views

- Use `logLevelTextClassName()` for log-level text coloring.
- Keep live log UX consistent: level filter, search, stream status badge, and scroll-to-bottom action.
- When live log streaming drops but the page data is still present, keep the investigation in context with an in-panel reconnect action rather than forcing a full page refresh.
- Long-lived live-log/EventSource views should pause in hidden tabs and resume from a dedupe-safe replay cursor when the tab becomes visible again.
- Do not keep opening live SSE log streams for terminal deployments; stopped/failed deployments should keep the historical log viewer in place but switch the stream affordance to an explicit inactive/no-new-logs state.
- Apply the same rule to route auto-refresh on log pages: terminal deployments should disable the polling affordance and explain that no new live log entries are expected.
- When deployment/project metadata loads but log history reads fail, keep the route usable and show inline live-data guidance instead of failing the whole page.
- Keep dashboard server-side live-data and log-proxy fetches timeout-bounded so hung upstream API calls degrade into explicit timeout/unavailable guidance instead of hanging route rendering indefinitely.
- Client-side operational polling widgets should also stay single-flight: skip overlapping ticks and abort stale in-flight requests on timeout or unmount.
- Interval-driven `router.refresh()` helpers should skip refreshes while a prior transition is still pending and avoid background-tab churn when the document is hidden.
- On status/operational pages, keep platform health visible but label deployment-history metrics as unavailable when project-scoped live data cannot be loaded; do not collapse that case into generic empty-state copy.
- When a status/operational panel is explicitly about deployment outcomes, render terminal deployments only; do not mix queued/building activity into outcome summaries.
- Keep operational labels tied to the actual data source. If a card is backed by the newest currently `running` deployment, label it accordingly instead of calling it a true historical “last successful deploy” metric.
- Keep platform badges semantically separate: the `API` badge should reflect the API `/health` endpoint, not be inferred from queue or worker health results.
- Preserve upstream operational status semantics even on non-200 health responses; for example, worker `stale` should remain `stale`, not be flattened into generic `unavailable`.
- Only render deployment runtime URLs as live links for actively `running` deployments; failed/stopped records should prefer truthful inactive copy over stale historical URLs, and `running` records without a public route should use explicit unavailable/not-publicly-exposed copy rather than `pending`.
- When a deployment remains `queued` or `building` but its metadata shows cancellation has been requested, keep the canonical status badge and add an explicit secondary `cancelling` cue plus updated guidance; do not keep describing it like a normal in-progress deploy.
- Apply the same cancellation-requested cue in compact text surfaces too, such as deployment selectors or operational summary rows; do not collapse those back to plain `queued`/`building`.
- When a dashboard filter exposes cancellation-requested deployments, model that as a derived `cancelling` view over queued/building records rather than overloading `stopped` or pretending cancellation is a first-class backend status.
- Apply that same derived cancellation-aware wording to plain-text detail rows too, so deployment detail views do not revert from `queued / cancelling` or `building / cancelling` back to raw backend status text.
- On deployment detail pages, use available lifecycle evidence to distinguish `stopped before activation` from `stopped after startup`; do not describe every stopped deployment as if it never reached runtime startup.
- Project overview cards should reflect the latest deployment state for that project, and degrade to an explicit `history unavailable` badge when deployment history for that project could not be loaded; do not flatten live projects into a generic `active` badge.
- On operational summary metrics, treat `stopped` deployments as terminal non-success outcomes rather than dropping them from success-rate calculations.
- Use `<time>` semantics for timestamps where practical.

## Project Scope and Navigation

- Prefer project-scoped routes (`/projects/[id]/...`) for project-specific actions and data.
- Keep top-level pages as global shortcuts/discovery surfaces.
- Use shared sidebar/settings navigation components for route consistency.

## Contribution Checklist (UI Changes)

Before merging UI changes, verify:

1. Shared primitives are used (`Button`, `Input`, `Select`, `Badge`, `Dialog`, `EmptyState`, `PageLayout`).
2. No raw palette utility classes are introduced where token variants exist.
3. Keyboard and focus behavior is preserved (especially dialogs and menus).
4. Typecheck, lint, and build pass for the dashboard workspace.
5. A screenshot is attached for visible component/layout changes.
