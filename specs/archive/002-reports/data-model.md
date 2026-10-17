# Data Model: HR Reports

**Spec**: [spec.md](spec.md) | **Date**: 2026-10-06

No new persisted entities. Reports are computed views over existing
`AttendanceSession`, `Timesheet`/`TimesheetEntry`, `Request`/`RequestType`,
`User`/`EmployeeProfile`, and `AuditEntry` data. This document defines the
*logical* report shapes that the API returns and the UI renders.

## Report (logical)

| Field | Notes |
|-------|-------|
| `key` | `attendance` \| `timesheets` \| `requests` \| `employees` |
| row shape | per report, below |
| supported filters | per report, below |
| summary | aggregates over the *entire* filtered scope |
| meta | `{report, filters: {applied}, generated_at}` |

## ReportFilters (input)

| Field | Type | Validation |
|-------|------|-----------|
| `date_from`, `date_to` | ISO date | `date_to ≥ date_from` else 400 `validation_error` |
| `employee` | int (user id) | must be inside caller's report scope else 400 |
| `department` | string | exact match (case-insensitive) on profile.department |
| `status` | enum per report | attendance: `PRESENT`\|`IN_PROGRESS`; timesheets/requests: `PENDING`\|`IN_REVIEW`\|`RETURNED`\|`APPROVED`\|`REJECTED`\|`WITHDRAWN`; employees report: not supported |
| `request_type` | int | requests report only |
| `lang` | `en`\|`ar` | export language; defaults `en` |
| `fmt` | `xlsx`\|`pdf` | export endpoint only; else 400 |

## ReportScope (per caller, via `GET /api/reports/scope/`)

| Field | Shape |
|-------|-------|
| `employees[]` | `{id, name, email, department, role}` — scope-filtered |
| `departments[]` | sorted distinct departments of visible employees |
| `request_types[]` | `{id, name}` — active types ∪ types used by in-scope requests |
| `can_pick_employee` | `true` for MANAGER/HR; `false` for EMPLOYEE |
| `generated_at` | timestamp |

## Row shapes

### attendance — one row per employee per work_date

`employee_id, employee_name, employee_email, department, date, check_in,
check_out, worked_seconds, worked_hours, required_hours(null),
difference_hours(null), sessions, status(PRESENT|IN_PROGRESS)`

Summary: `total_worked_hours, required_hours(null), attendance_days,
employees, sessions, late_days(null), overtime_hours(null),
required_hours_available=false, late_days_available=false,
overtime_available=false`

### timesheets — one row per weekly timesheet

`id, employee_*, week_start(Mon), week_end(Sat), business_week_start(Sun),
logged_hours, required_hours(null), difference_hours(null), status,
status_group, current_actor_role, submitted_at, reviewed_at`

Sun–Sat rule: `business_week_start = week_start − 1 day`,
`week_end = week_start + 5 days`. Displayed span = business_week_start → week_end.

Summary: `timesheets, total_logged_hours, required_hours(null), by_status,
by_status_group, required_hours_available=false`

### requests — one row per request

`id, employee_*, request_type_id, request_type, created_at, status,
status_group, current_actor_role, current_step(1-based| null), total_steps`

Summary: `total, by_status, by_status_group, by_request_type,
by_type_status[{request_type, status, count}]`

### employees — one row per visible employee

`employee_id, employee_name, employee_email, department, attendance_days,
worked_hours, sessions, timesheets, timesheets_approved, logged_hours,
requests_total, requests_pending, requests_approved, requests_rejected,
requests_cancelled`

Summary: same keys summed across rows + `employees` count.

## Invariants

- **Scope**: every row must pass the caller's existing authorization scope
  (`scope_items` for requests/timesheets, `scope_attendance` for attendance);
  the employee axis is `visible_employees(user)`. Exports share the identical
  scoped queryset as on-screen rows.
- **Status integrity**: `status` carries the internal enum; `status_group`
  (pending/approved/rejected/cancelled) is a *display grouping* and never
  overwrites `status`.
- **Honesty**: metrics with no source of truth are `null` + `*_available:false`;
  never fabricated numbers.
- **Pagination**: on-screen rows paginate (`{count,next,previous,results}` +
  `summary` + `meta`); exports materialize the full filtered set up to caps
  (xlsx 50 000, pdf 2 000 rows; over → 400 `validation_error`).
