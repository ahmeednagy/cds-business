# Quickstart Validation: HR Reports

**Spec**: [spec.md](spec.md) | **Contract**: [contracts/api.md](contracts/api.md)

## Prerequisites

- Docker stack running from repo root: `docker compose up -d` (frontend :5173,
  backend :8000, PostgreSQL :5433).
- Demo data seeded: `docker compose exec backend python manage.py seed_demo`
  (users: `employee@cdsbusiness.dev`, `employee2@cdsbusiness.dev`, `manager@cdsbusiness.dev`,
  `hr@cdsbusiness.dev` — all `CDS!Demo2026`).
- For richer data, check in/out as the demo employee at least once to create a
  real attendance session.

## Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| V1 | Employee self-scope | Sign in as `employee@cdsbusiness.dev` → sidebar **Reports** → run each report | Only Lina Khoury's data; no Employee picker (self only) |
| V2 | Manager scope | Sign in as `manager@cdsbusiness.dev` → Reports → Requests + Employee Summary | Own + direct reports (Lina, Sami) only; Employee picker offers exactly those |
| V3 | HR least-privilege | Sign in as `hr@cdsbusiness.dev` → Requests/Timesheets vs Attendance/Employees | Requests/timesheets show only HR-step items (+ own); attendance + employee summary are org-wide aggregates |
| V4 | Filters | As manager: Requests → set date range + status PENDING + request type → Generate | Table + summary reflect only matching rows; applied filters shown |
| V5 | Invalid range | Any report → Date From `2024-06-10`, Date To `2024-06-01` → Generate | Validation error naming the date field; no rows |
| V6 | Reset | After V4 → click Reset | Filters cleared, unfiltered report reloads |
| V7 | Empty state | Filter to a range with no data | Explicit empty state, not a blank table |
| V8 | Excel export | Run a filtered report → **Excel** | `.xlsx` downloads; rows match on-screen filtered set + summary sheet; Arabic UI → RTL sheet |
| V9 | PDF export | Same → **PDF** | `.pdf` downloads with CDS branding, title, filters, timestamp, summary, all rows; Arabic UI → shaped RTL text |
| V10 | Print | Run a report → **Print** (or Ctrl+P) | Print preview shows report title/filters/summary/table without nav or buttons |
| V11 | Localization | Switch to العربية → repeat a report + export | Full RTL layout; all labels/statuses Arabic; export follows `lang` |
| V12 | Themes | Toggle dark theme on Reports | Contrast preserved on tables, chips, summary cards |
| V13 | Responsive | DevTools mobile viewport | Filters stack; table scrolls horizontally; no layout break |
| V14 | Sun–Sat week | Timesheets report row for `week_start` 2024-06-03 | Displayed week spans Sun 2024-06-02 → Sat 2024-06-08 |
| V15 | Honest metrics | Any report | Required/overtime/late shown as unavailable (—), never a number |
| V16 | Export parity | As employee, hit `/api/reports/requests/export/?fmt=xlsx` directly | File contains only employee's own requests |

## Test commands

```bash
# Backend (in Docker)
docker compose exec backend pytest -q

# Frontend (in Docker)
docker compose exec frontend npm test

# Lint/typecheck
docker compose exec backend ruff check .
docker compose exec frontend npx tsc -b
```
