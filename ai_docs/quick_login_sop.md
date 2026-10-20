# Quick Login — Developer SOP

## Purpose & business context
Demo convenience on the CDS Business login page: three compact persona cards
(Ahmed / Manager / HR) below the Sign In button let a presenter sign in
one-click without typing credentials. Demo/local-dev only — the whole feature
disappears unless the backend explicitly exposes it.

## Design decision (security)
Passwords are never shipped to the frontend. Instead of embedding credentials,
the backend exposes a passwordless, whitelisted demo endpoint that issues the
**identical** JWT pair + `cds_refresh` HttpOnly cookie as `LoginView`:

- `GET /api/auth/quick-login/` → `{"accounts": ["ahmed","hr","manager"]}`
  — only keys whose mapped user exists **and is active**. 404 when disabled.
- `POST /api/auth/quick-login/` `{"key": "hr"}` → `{"access": ...}` + refresh
  cookie. 404 for unknown keys, missing/inactive users, or when disabled.

### Enablement
`config/settings/base.py`:
- `DEMO_QUICK_LOGIN` — `"auto"` (default) follows `DEBUG` (dev.py → on,
  prod.py → off). Force with env `DJANGO_DEMO_QUICK_LOGIN=1|0`.
- `DEMO_QUICK_LOGIN_ACCOUNTS` — key → email map (emails only, no secrets):
  `ahmed` → ahmed.nagy@cdsbussiness.com, `manager` →
  ramadan.khalil@cdsbussiness.com, `hr` → shrouk.youssry@cdsbussiness.com.

The endpoint shares the `login` throttle scope (10/min) and the standard
`{error:{code,message}}` envelope via `apps.core.exceptions`.

## Files changed
| File | Change |
|---|---|
| `backend/config/settings/base.py` | `DEMO_QUICK_LOGIN`, `DEMO_QUICK_LOGIN_ACCOUNTS` |
| `backend/apps/accounts/views.py` | `_quick_login_enabled()`, `_quick_login_accounts()`, `QuickLoginView` |
| `backend/apps/accounts/urls_auth.py` | `quick-login/` route |
| `backend/tests/integration/test_auth.py` | 5 quick-login tests |
| `frontend/src/lib/auth.tsx` | `quickLogin(key, remember)` + shared `acceptSession()` |
| `frontend/src/features/auth/quick-login.tsx` | NEW — card grid component |
| `frontend/src/features/auth/login.tsx` | mounts `<QuickLogin>` below the form; `quickPending` state; sign-in button disabled while any auth is in flight |
| `frontend/src/i18n/{en,ar}.json` | `auth.quickLogin.{divider,loginAs,ahmed,manager,hr}` |
| `frontend/tests/login.test.tsx` | 5 quick-login tests + fetch stub helper |
| `frontend/vite.config.ts` | repaired stray `server:` block; `allowedHosts` merged |

## Frontend mechanics
`QuickLogin` fetches the account list on mount; on error/empty it renders
nothing. Cards are pure frontend persona definitions (key, accent color, MUI
icon) filtered by backend-advertised keys. Errors go through the login page's
existing `serverError` display; pending shows a spinner on the clicked card
and disables all auth controls. `quickLogin()` reuses the exact session flow
(`setAccessToken` + `refreshUser` + `cds-remember`), then navigates to `/`.

## Test scenarios
- Happy path: click a card → session issued → dashboard. Covered by
  `test_quick_login_issues_same_session_as_login` and the RTL test
  `logs in via a persona and navigates to the app`.
- Edge: unknown key / inactive user / disabled flag → 404; personas missing
  from the DB are filtered from GET. Covered.
- Permission: endpoint is `AllowAny` by design (it *is* the login); abuse is
  bounded by the login throttle + whitelist + DEBUG gate.

## Known limitations
- Persona visuals (names/colors/icons) are hardcoded per key — a new key in
  `DEMO_QUICK_LOGIN_ACCOUNTS` won't render until added to `PERSONAS` in
  `quick-login.tsx`.
- Quick login always sets `remember=1` (no checkbox on the card).
- If the seed data isn't loaded, GET returns `[]` and the section hides itself.
