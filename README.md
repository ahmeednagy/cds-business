# CDS Business — HR Management Platform

Full-stack HR platform for general companies. Three roles — **Employee**,
**Manager**, **HR** — with employee profiles, configurable HR requests, weekly
timesheets, workflow-driven reviews, notifications, audit history, dashboards,
and secure request attachments.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod |
| Backend | Django + Django REST Framework (modular monolith), Simple JWT |
| Database | PostgreSQL 16 (SQLite for local dev/tests) |
| Files | Private local filesystem (`media/`) — never web-served |
| Deploy | Docker Compose + Nginx |

## Layout

```
backend/    Django project — config/, apps/{core,accounts,workflows,requests,
            timesheets,notifications,audit}, tests/
frontend/   Vite React app — src/{components,features,lib,routes,types}, tests/
deploy/     docker-compose.yml, Dockerfiles, nginx/
media/      Private attachment storage (gitignored, never proxied)
specs/      Feature spec, plan, data model, contracts, tasks
```

## Authentication model

- `POST /api/auth/login/` → short-lived access token (15 min) + rotating
  refresh token (1 day) in an HttpOnly/Secure/SameSite=Lax cookie.
- HR issues temporary passwords; `must_change_password` blocks all other
  endpoints until the user sets a new password.
- Self-service reset: `POST /api/auth/password-reset/` sends a link
  (`/reset-password/:uid/:token`, signed token, 1 h expiry, single-use — it
  invalidates automatically once the password changes). The response is
  identical for registered and unregistered addresses, and the scope is
  throttled separately from login. `GET/POST .../password-reset/confirm/`
  validates the link and performs the reset.
- Server-side RBAC + object-level scoping on every endpoint; client role
  checks are display-only.

### Testing password reset locally

No SMTP server is needed: `EMAIL_BACKEND` defaults to Django's console
backend, so reset emails print to the runserver terminal.

1. `python manage.py runserver` and open `http://localhost:5173/forgot-password`.
2. Submit any seeded email (e.g. `ahmed.nagy@cdsbussiness.com`) — the confirmation
   screen is the same for unknown addresses by design.
3. Copy the `…/reset-password/<uid>/<token>` URL out of the email printed in
   the backend console and open it in the browser.

For real delivery set `EMAIL_BACKEND`/`EMAIL_HOST`/… and `DEFAULT_FROM_EMAIL`,
and set `FRONTEND_URL` to the deployed origin so links point at the right host.

## Run locally

```bash
# Backend (Python 3.12+)
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # 16 CDS demo users @cdsbussiness.com + rich data
python manage.py seed_demo --reset  # destructive rebuild of the demo dataset
python manage.py runserver          # http://localhost:8000

# Frontend (Node 22+)
cd frontend
npm install
npm run dev                         # http://localhost:5173 (proxies /api → :8000)
```

Demo credentials — password `CDS!Demo2026` for every seeded account:
`ahmed.nagy@cdsbussiness.com` (Developer), `islam.gamal@cdsbussiness.com`
(Implementor), `ramadan.khalil@cdsbussiness.com` / `waleed.elbahar@cdsbussiness.com`
(Managers), `shrouk.youssry@cdsbussiness.com` (HR). `seed_demo --reset` wipes
demo/transactional data and reseeds (local-dev guard; never auto-runs).

`seed_demo --scale N` adds N bulk employees with pending requests for
performance checks.

## Docker (local development)

One command from the repo root starts the full stack — Vite dev server,
Django runserver, PostgreSQL 16, and Adminer:

```bash
docker compose up --build        # build + start all services (foreground)
docker compose up -d             # same, detached
docker compose ps                # service status
docker compose logs -f backend   # follow Django logs
docker compose logs -f frontend  # follow Vite logs
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo   # explicit, never auto-runs
docker compose down              # stop (PostgreSQL data persists in the pgdata volume)
```

| Service | Address |
|---------|---------|
| Frontend (Vite dev + HMR) | http://localhost:5173 |
| Backend (Django/DRF) | http://localhost:8000 |
| Django Admin | http://localhost:8000/admin/ |
| PostgreSQL | localhost:5432 |
| Adminer | http://localhost:8080 |

Adminer login: System `PostgreSQL`, Server `db`, User `wasl`,
Password `wasl_dev_password`, Database `wasl`.

The frontend container proxies `/api/*` to `http://backend:8000` via
`VITE_API_PROXY_TARGET` (vite.config.ts). On the host it still targets
`http://localhost:8000`. Backend waits for the Postgres healthcheck, runs
`migrate` automatically, and hot-reloads via mounted source — seeding stays
explicit so `up` never resets your data. Copy `.env.example` to `.env` to
override defaults (`.env` is gitignored).

### Docker (deploy-style)

```bash
cd deploy
POSTGRES_PASSWORD=secret DJANGO_SECRET_KEY=secret docker compose up --build
```

Nginx serves the SPA and proxies `/api/` to the backend. There is intentionally
**no** media/file location — attachments stream through authorized API
endpoints only.

## Tests

```bash
cd backend && python -m pytest        # 143 tests: auth, scoping, workflows, perf
cd frontend && npx vitest run         # component tests (Testing Library)

# Inside the backend container, force test settings (compose exports dev):
docker compose exec -e DJANGO_SETTINGS_MODULE=config.settings.test backend python -m pytest
```

## API conventions

- All lists paginate: `{count, next, previous, results}` (default 25, max 100).
- Errors: `{error: {code, message, details?}}` — no internals.
- Requests/timesheets expose `actions[]` — server-computed legal transitions;
  the backend is the sole security boundary.
