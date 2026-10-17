# API Contract: HR Reports

**Style**: REST/JSON under `/api/`. Auth = `Authorization: Bearer <access_token>`.
Same conventions as the platform contract (`specs/001-hr-platform/contracts/api.md`):
paginated envelope `{count, next, previous, results}`, error envelope
`{error:{code,message,details?}}`, `404` masks out-of-scope objects, `400
validation_error` covers invalid filter input (including `date_to < date_from`).

**Scope rule (authoritative, server-side)**: every report row derives from the
caller-visible scope — EMPLOYEE→own; MANAGER→own+direct reports (live reporting
line); HR→org-wide attendance, own items, and items whose workflow assigns an HR
step (`requires_hr_review`). Export endpoints apply the *identical* scope and
filters as the corresponding JSON report.

## Reports (`/api/reports/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/reports/scope/` | any auth | `{employees[], departments[], request_types[], can_pick_employee, generated_at}` — the caller's permitted filter vocabulary; already scope-filtered |
| GET | `/api/reports/attendance/` | scoped | rows per employee-day; filters: `date_from`, `date_to`, `employee`, `department`, `status`(`PRESENT`\|`IN_PROGRESS`). Response: `results` + `summary` + `meta` |
| GET | `/api/reports/timesheets/` | scoped | rows per timesheet; filters: `date_from`, `date_to`, `employee`, `department`, `status`(workflow statuses) |
| GET | `/api/reports/requests/` | scoped | rows per request; filters: `date_from`, `date_to`, `employee`, `department`, `status`, `request_type` |
| GET | `/api/reports/employees/` | scoped | rows per visible employee; filters: `date_from`, `date_to`, `employee`, `department` (no status/request_type) |
| GET | `/api/reports/{key}/export/` | scoped | `fmt=xlsx`\|`pdf` required + any report filters + `lang=en`\|`ar` → file download (`Content-Disposition: attachment`); full filtered row set, capped (xlsx 50k / pdf 2k rows → 400 `validation_error` instructing to narrow filters). `{key}` not in the four reports → 404 |

## Query params (reports)

| Param | Applies to | Rules |
|-------|-----------|-------|
| `date_from`, `date_to` | all | `YYYY-MM-DD`; `date_to < date_from` → 400 |
| `employee` | all | user id inside caller scope else 400 |
| `department` | all | case-insensitive match on profile department |
| `status` | attendance/timesheets/requests | whitelist per report else 400 |
| `request_type` | requests | request type id |
| `lang` | exports | `en`\|`ar` (controls export text + RTL) |
| `fmt` | exports | `xlsx`\|`pdf` required |

## Response notes

- `meta.filters` echoes the *applied* (parsed/validated) filters — shown in the
  UI and printed/exported headers.
- Summary aggregates are computed over the full filtered scope, not the page.
- Unavailable metrics serialize as `null` + `*_available: false` flags.
- Status fields carry internal enum values; clients render localized labels.
- All endpoints reject unauthenticated calls (401) and are gated by the
  forced-password-change rule like every other `/api/` endpoint.
