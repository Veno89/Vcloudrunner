# Dashboard Service

Next.js dashboard scaffold for the single-node Vcloudrunner MVP.

## Current scope

- project list + creation form (live API when configured; otherwise explicit demo-mode fallback on the top-level page)
- deployment table (live API when configured; otherwise explicit demo-mode fallback on the top-level page)
- deployment trigger action (server action -> API)
- environment variable editor (project selector + list/add/delete via API)
- deployment logs viewer with deployment selector, optional 5-second auto-refresh, and live SSE stream panel
- settings account/session surface that shows the resolved viewer, available profile details, and current auth source from `/v1/auth/me`

## Next

- improve live log stream resiliency/reconnect UX (current transport: SSE)
- add optimistic create UX (disable/pending state) and field-level validation messaging

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_DEMO_USER_ID` (optional; now only used as a local dev-auth `x-user-id` hint when the API is running with `ENABLE_DEV_AUTH=true`)
  - the dashboard now resolves live user context from the authenticated API actor via `/v1/auth/me`
  - keep this unset in normal token-backed flows; set it only when you explicitly want local dev-auth requests to impersonate a specific user ID
- `API_AUTH_TOKEN` (server-side bearer token used by dashboard when calling API)
  - prefer a DB-backed token from `/v1/users/:userId/api-tokens` or an explicit `API_TOKENS_JSON` bootstrap token
  - `dev-admin-token` is only valid when the API has `ENABLE_DEV_AUTH=true`, which should remain a local-only opt-in bypass
