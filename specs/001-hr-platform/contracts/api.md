# API Contract: CDS Business HR Platform

**Style**: REST/JSON under `/api/`. Auth = `Authorization: Bearer <access_token>` unless
noted. All list endpoints are paginated (`page`, `page_size`≤100; response envelope
`{count, next, previous, results}`). Errors: `{error: {code, message, details?}}` — never
internals. Codes: `400 validation_error`, `401 unauthenticated`, `403 forbidden`,
`404 not_found` (also used to mask existence of out-of-scope objects), `409 conflict`.
`400 validation_error` also covers invalid filter ranges (e.g., end date before start).

Conventions: filtering via query params on declared fields only; search via `?search=` on
designated fields; `?ordering=` on designated fields.

## Auth (`/api/auth/`)

| Method | Path | Body → Response | Notes |
|--------|------|-----------------|-------|
| POST | `/api/auth/login/` | `{email, password}` → `{access}` + sets `refresh` HttpOnly cookie | generic failure on bad credentials (FR-004); 200 also when `must_change_password` — subsequent calls gated |
| POST | `/api/auth/refresh/` | (cookie) → `{access}` + rotated cookie | rotating refresh |
| POST | `/api/auth/logout/` | — | blacklists refresh cookie |
| POST | `/api/auth/change-password/` | `{current_password, new_password}` → 204 | clears `must_change_password`; only endpoint usable while flag set |

## Users & Profiles (`/api/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/me/` | any | `{id, email, role, profile:{…}, must_change_password}` |
| PATCH | `/api/me/profile/` | EMPLOYEE+ | only whitelisted employee-editable fields accepted; 403/`validation_error` on HR-managed fields (FR-010) |
| GET | `/api/employees/` | HR | list; filters: `is_active`, `manager`, `search` (name/email) |
| POST | `/api/employees/` | HR | `{email, role, manager?, first_name, last_name, …}` → creates user+profile, returns `{…, temporary_password}` **once** |
| GET/PATCH | `/api/employees/{id}/` | HR | detail / update (role, manager, HR-managed fields, `is_active`) |
| POST | `/api/employees/{id}/reset-password/` | HR | → `{temporary_password}` once; sets `must_change_password` (audited) |
| GET | `/api/team/` | MANAGER | direct reports + their counts of pending items |

## Request Types (`/api/request-types/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/request-types/` | any auth | active types: `{id, name, fields_schema, allow_attachments, require_attachments}` (employees see active only; HR sees all incl. `is_active`) |
| POST | `/api/request-types/` | HR | `{name, workflow_id, fields_schema, …}` |
| PATCH | `/api/request-types/{id}/` | HR | update fields/schema/active; existing requests unaffected |

## Requests (`/api/requests/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/requests/` | scoped | EMPLOYEE→own; MANAGER→own+reports; HR→items where workflow assigns an HR step. Filters: `status`, `request_type`, `submitter`, `date_from`, `date_to`, `search` |
| POST | `/api/requests/` | EMPLOYEE+ | `{request_type, values{…}, comment}` → `201` with item; validates required fields per type schema |
| GET | `/api/requests/{id}/` | scoped | detail incl. `status`, `current_step`, `values`, `attachments[]`, `actions[]` (available actions for caller: approve/reject/return/withdraw/resubmit) |
| POST | `/api/requests/{id}/submit/` | owner | DRAFT-less: submission is POST /requests/ itself; this endpoint resubmits a `RETURNED` item (`{values, comment}`) |
| POST | `/api/requests/{id}/withdraw/` | owner | only while pending & no reviewer action → `WITHDRAWN` (409 if raced) |
| POST | `/api/requests/{id}/approve/` | step actor | `{comment?}` → advances step or `APPROVED` |
| POST | `/api/requests/{id}/reject/` | step actor | `{comment}` (required if step demands) → `REJECTED` |
| POST | `/api/requests/{id}/return/` | step actor | `{comment}` → `RETURNED`, editable by submitter |
| GET | `/api/requests/{id}/history/` | scoped | chronological audit entries `{actor, action, from_status, to_status, comment, created_at}` |

## Attachments (`/api/attachments/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| POST | `/api/attachments/` | owner | `multipart`: `{request, file}` → 201; 400 on bad type/size (allowlist, ≤10 MB); 409 if parent not in editable state |
| GET | `/api/attachments/{id}/` | parent-scoped | streams file with `Content-Disposition`; 404 for unauthorized (existence masked) |
| DELETE | `/api/attachments/{id}/` | owner | soft-delete while parent editable → 204; removed files return 404 on download; record retained |

## Timesheets (`/api/timesheets/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/timesheets/` | scoped | same scoping as requests. Filters: `status`, `employee`, `week_start` |
| POST | `/api/timesheets/` | EMPLOYEE+ | `{week_start, entries:[{date, hours}]}` → 201; 409 on duplicate employee+week; 400 on entries outside week / hours>24 |
| GET | `/api/timesheets/{id}/` | scoped | detail + `actions[]` |
| POST | `/api/timesheets/{id}/submit/` | owner | resubmit `RETURNED` |
| POST | `/api/timesheets/{id}/withdraw/` | owner | same rule as requests |
| POST | `/api/timesheets/{id}/approve|reject|return/` | step actor | identical semantics to requests |
| GET | `/api/timesheets/{id}/history/` | scoped | audit trail |

## Workflows (`/api/workflows/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/workflows/` | HR | `{id, name, steps:[{order, actor_role, require_comment_*}]}` |
| POST | `/api/workflows/` | HR | create with ≥1 step; `actor_role ∈ MANAGER|HR` |
| PATCH | `/api/workflows/{id}/` | HR | edit steps — in-flight items keep their snapshot |

## Notifications (`/api/notifications/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/notifications/` | any | own only; filter `unread=true`; `{id, message, item_type, item_id, read_at, created_at}` |
| POST | `/api/notifications/{id}/read/` | owner | → 204 |
| POST | `/api/notifications/read-all/` | owner | → `{marked: n}` |

## Dashboards (`/api/dashboard/`)

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | `/api/dashboard/` | any | role-shaped payload: employee `{open_requests, timesheet_status, unread_notifications}`; manager adds `{pending_reviews, team_activity}`; HR adds `{org_volumes, pending_items}` |

## Cross-cutting guarantees

- Every mutating endpoint runs in one transaction and emits its `AuditEntry`
  (and `Notification`s) atomically with the state change.
- `actions[]` in item detail is the server-computed set of legal actions for the caller —
  the UI renders buttons from it but the server re-validates on POST.
- Rate limiting on `/api/auth/login/` (brute-force throttle) — implementation detail for
  tasks; contract: `429` responses possible.

---

# Appendix: Reports endpoints (merged from `specs/archive/002-reports/contracts/api.md`)

Same conventions: paginated envelope, `404` masks out-of-scope, `400
validation_error` for invalid filters (incl. `date_to < date_from`).

| Method | Path | Contract |
|--------|------|----------|
| GET | `/api/reports/scope/` | caller's permitted filter vocabulary: `{employees[], departments[], request_types[], can_pick_employee, generated_at}` |
| GET | `/api/reports/attendance/` | per employee-day rows; filters: date range, employee, department, `status`(PRESENT\|IN_PROGRESS) → `{results, summary, meta}` |
| GET | `/api/reports/timesheets/` | per timesheet; filters: date range, employee, department, status |
| GET | `/api/reports/requests/` | per request; filters: date range, employee, department, status, request_type |
| GET | `/api/reports/employees/` | per visible employee; filters: date range, employee, department |
| GET | `/api/reports/{key}/export/` | `fmt=xlsx`\|`pdf` + report filters + `lang=en`\|`ar` → attachment download; row-capped (50k/2k → 400) |

Scope rule: EMPLOYEE→own; MANAGER→own+direct reports (live line);
HR→org-wide attendance/employees + HR-step items only. `meta.filters` echoes
applied filters; summaries cover the full filtered set.
