## MODULE: quick_login
## VERSION: 1.0
## LAST_UPDATED: 2026-10-20

### MODELS
- none — reuses accounts.User + existing JWT flow

### METHODS
- QuickLoginView.get() → {accounts:[keys]} | 404 | filters to existing+active users
- QuickLoginView.post(key) → {access}+refresh cookie | 404 disabled/unknown/inactive
- _quick_login_enabled() → bool | DEMO_QUICK_LOGIN "auto"→DEBUG, else env truthy
- _quick_login_accounts() → {key:email} | intersects DEMO_QUICK_LOGIN_ACCOUNTS with active users
- auth.tsx quickLogin(key,remember=true) → POST /api/auth/quick-login/ → acceptSession → refreshUser
- auth.tsx acceptSession(access,remember) → shared token/remember/me flow (also used by login)

### VIEWS
- /api/auth/quick-login/ | GET+POST | AllowAny | throttle_scope="login"
- login.tsx | mounts <QuickLogin> after </form> | quickPending state | authBusy disables all
- quick-login.tsx | NEW | divider "Or quick login as" + grid auto-fit minmax(132px) | glass cards: icon-circle + LOGIN AS label + name + arrow-circle | accents ahmed=#3B82F6 manager=#22C55E hr=#A855F7 | icons PersonOutline/WorkspacePremium/Groups | hidden when endpoint 404/empty

### SECURITY
- AllowAny endpoint gated by DEMO_QUICK_LOGIN (auto=DEBUG only; prod DEBUG=False → 404)
- No passwords anywhere in frontend/source — server-side email whitelist only
- Same login throttle (10/min); same refresh-cookie flags; generic error envelope

### DEPENDENCIES
- apps.accounts (User) | config.settings (DEMO_QUICK_LOGIN*) | i18n auth.quickLogin.*

### EXTERNAL_LINKS
- DEMO_QUICK_LOGIN_ACCOUNTS ↔ accounts.User via email (ahmed.nagy/ramadan.khalil/shrouk.youssry @cdsbussiness.com)

### KNOWN_CONSTRAINTS
- New persona keys need a PERSONAS entry in quick-login.tsx to render
- remember always true for quick login
- GET returns only personas whose user exists+is_active → empty = section hidden
- vite.config.ts had stray `server:` block appended after export — repaired by merging allowedHosts into real server block

### CHANGE_LOG
- 2026-10-20 | added QuickLoginView + frontend card section, i18n keys, 5+5 tests
