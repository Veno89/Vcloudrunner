# Dashboard Service

Next.js dashboard scaffold for the single-node Vcloudrunner MVP.

## Current scope

- project list + creation form (live API when configured; otherwise explicit demo-mode fallback on the top-level page)
- deployment table (live API when configured; otherwise explicit demo-mode fallback on the top-level page)
- deployment trigger action (server action -> API)
- environment variable editor (project selector + list/add/delete via API)
- deployment logs viewer with deployment selector, optional 5-second auto-refresh, and live SSE stream panel
- settings account/session surface that shows the resolved viewer, available profile details, and current auth source from `/v1/auth/me`
- interactive dashboard sign-in flow that stores a per-user API token in an httpOnly session cookie and treats the server env token as a fallback path only
- persisted-user account setup flow for bootstrap/dev actors before they move into normal DB-backed token and project-creation workflows

## Next

- improve live log stream resiliency/reconnect UX (current transport: SSE)
- add optimistic create UX (disable/pending state) and field-level validation messaging

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`)
- `NEXT_PUBLIC_DEMO_USER_ID` (optional; now only used as a local dev-auth `x-user-id` hint when the API is running with `ENABLE_DEV_AUTH=true`)
  - the dashboard now resolves live user context from the authenticated API actor via `/v1/auth/me`
  - keep this unset in normal token-backed flows; set it only when you explicitly want local dev-auth requests to impersonate a specific user ID
- `API_AUTH_TOKEN` (optional server-side bearer-token fallback used only when no dashboard session cookie is present)
  - prefer per-user sign-in sessions for normal operator workflows; the env token is just a shared fallback path
  - prefer a DB-backed token from `/v1/users/:userId/api-tokens`; bootstrap tokens from `API_TOKENS_JSON` should mainly be used to reach account setup and mint the real DB-backed tokens afterwards
  - `dev-admin-token` is only valid when the API has `ENABLE_DEV_AUTH=true`, which should remain a local-only opt-in bypass
