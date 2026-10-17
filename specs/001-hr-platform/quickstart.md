# Quickstart & Validation: CDS Business HR Platform

Runnable end-to-end validation scenarios proving the feature works. See
`contracts/api.md` for endpoint shapes and `data-model.md` for states.

## Prerequisites

- Docker Engine + Docker Compose
- Repo root: `deploy/docker-compose.yml`

## Setup

```bash
cd deploy && docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo   # creates HR admin, manager, employees, a request type, default workflow
```

SPA at `http://localhost/` — API under `http://localhost/api/`.

Seed accounts (demo only): `ramadan.khalil@cdsbussiness.com` / `ramadan.khalil@cdsbussiness.com` /
`ahmed.nagy@cdsbussiness.com` — each with a temporary password (first login forces a change).

## Validation scenarios

### V1 — Auth & role gating (US1, SC-001)

1. Sign in as `ahmed.nagy@cdsbussiness.com` → set new password → lands on employee dashboard.
2. In the SPA, attempt to open `/admin` (HR area) and the manager queue → blocked.
3. `curl` a manager-only endpoint with the employee token → expect `403`/`404`.
4. `curl` any protected endpoint with no token → expect `401`.
5. Repeat sign-in checks for `manager@` and `hr@` — each sees their own surface.

### V2 — Profile (US2)

As employee: update phone/address → saved, persists after reload. Attempt to PATCH
`job_title` via API → rejected (HR-managed). As manager: open a direct report's profile
→ readable. As employee: open another employee's profile → denied.

### V3 — Request lifecycle (US3, US5, US7)

1. Employee: create request of the seeded type with a required field missing →
   field-level 400. Complete it → `PENDING`.
2. Employee: attach a PDF → appears on the request; copy its URL into an incognito
   window → `404`/`401` (SC-008).
3. Employee: withdraw the pending request → `WITHDRAWN`, immutable, in history.
4. Employee: submit a second request → manager sees it in queue; manager **returns**
   with comment → employee gets notification, request `RETURNED`.
5. Employee: edit + resubmit → `PENDING` again; manager **approves** → `APPROVED`,
   read-only.
6. Item history shows every step with actor + timestamp (SC-004); manager's queue count
   decremented; employee notified at each decision.

### V4 — Timesheet cycle (US6)

Employee submits a week timesheet (per-day entries) → `PENDING`. Duplicate for the same
week → `409`. Manager returns → employee corrects, resubmits → manager approves →
`APPROVED`, read-only.

### V5 — RBAC boundary matrix (SC-001)

For each endpoint in `contracts/api.md`, call it as each role + anonymous and confirm
the documented allow/deny — automated: `docker compose exec backend pytest tests/permissions -q`.

### V6 — HR administration (US8)

As HR: create a new employee (gets temporary password) → that user can sign in and is
forced to change it. Deactivate an employee → sign-in rejected, records intact (FR-045).
Create a new request type with a 2-step workflow (MANAGER then HR) → employee submits it
→ manager approves → item waits on HR step → HR approves → `APPROVED`.

### V7 — Scale & errors (SC-006, SC-009)

Seed 10k requests → list stays paginated and responsive; filters by status/date work.
Trigger a validation error and a 404 → responses contain no stack traces or internals.

## Definition of Done

All V-scenarios pass plus: backend `pytest` green (unit + integration + permissions),
frontend `vitest` green, `docker compose up` cold-start works.

---

# Appendix: Reports validation (merged from `specs/archive/002-reports/quickstart.md`)

| # | Scenario | Expected |
|---|----------|----------|
| R1 | Employee opens each report | own data only; no employee picker |
| R2 | Manager opens Requests/Employees | own + direct reports only; picker scoped |
| R3 | HR opens Requests/Timesheets vs Attendance/Employees | HR-step items only vs org-wide aggregates |
| R4 | Apply date+status+type filters, Generate | table+summary reflect matches |
| R5 | Date To < Date From | field validation error, no rows |
| R6 | Reset | filters cleared, unfiltered reload |
| R7 | Filter to empty range | explicit empty state |
| R8 | Excel export | `.xlsx` = filtered rows + summary; AR → RTL sheet |
| R9 | PDF export | branded `.pdf`, filters, timestamp, all rows; AR shaped/RTL |
| R10 | Print | clean print: title/filters/summary/table, no chrome *(pending RT015)* |
| R11 | Arabic UI + export | full RTL, Arabic labels, export follows `lang` |
| R12 | Dark theme | contrast preserved |
| R13 | Mobile viewport | filters stack, table scrolls |
| R14 | Timesheet `week_start` Mon 2024-06-03 | span Sun 2024-06-02 → Sat 2024-06-08 |
| R15 | Any report | required/overtime/late show "—", never fabricated |
| R16 | Direct export URL as employee | file contains only own rows |
