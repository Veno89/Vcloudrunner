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
- Use `LiveDataUnavailableState` for route-level live-data failures on project-scoped or settings pages when rendering real content is not possible.
- Route-level/global error views should use `Card` + shared `Button` retry action.

## Status and Feedback

- Use `Badge` variants for status semantics:
  - `success`, `warning`, `destructive`, `info`, `secondary`, `outline`
- Avoid hardcoded palette classes in component-level status indicators.
- For action outcomes, prefer `ActionToast`/toast-based feedback over persistent URL banners.

## Logs and Operational Views

- Use `logLevelTextClassName()` for log-level text coloring.
- Keep live log UX consistent: level filter, search, stream status badge, and scroll-to-bottom action.
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
