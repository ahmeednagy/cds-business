## MODULE: reports_page (frontend features/reports + apps/reports)
## VERSION: 1.0
## LAST_UPDATED: 2026-10-12

### API
- GET /api/reports/scope/ → {employees[], departments[], request_types[], can_pick_employee}
- GET /api/reports/<attendance|timesheets|requests|employees>/ → {results[], count, summary, meta} | params: page, page_size, lang, date_from, date_to, employee, department, status, request_type(requests only)
- GET /api/reports/<report>/export/?fmt=xlsx|pdf → file download, same filters/scope
- status validation per report: attendance→PRESENT/IN_PROGRESS; timesheets/requests→workflow statuses; employees→none (400 if sent)
- date_to < date_from → 400 validation_error; employee outside scope → 400

### ROW FIELDS (all reports)
- employee_name, employee_email, department | attendance adds: date, check_in, check_out, worked_hours, sessions, status(PRESENT/IN_PROGRESS)
- timesheets adds: id, business_week_start, week_end, logged_hours, status, submitted_at
- requests adds: id, request_type, created_at, status, current_actor_role, current_step, total_steps
- employees adds: attendance_days, worked_hours, sessions, timesheets, logged_hours, requests_total/pending/approved/rejected/cancelled

### SUMMARY KEYS
- attendance: total_worked_hours, attendance_days, sessions, employees, *_available=False (required/late/overtime never fabricated)
- timesheets: timesheets, total_logged_hours, by_status, by_status_group
- requests: total, by_status, by_status_group, by_request_type, by_type_status
- employees: employees, attendance_days, total_worked_hours, timesheets, total_logged_hours, requests_*

### VIEW (frontend/src/features/reports/index.tsx)
- Custom header (1.75rem/800 + subtitle + 50px outlined XLSX/PDF export buttons)
- Filter card: draft/applied pattern; Report select commits on Apply; Clear resets filters but keeps report; draft report change resets status+requestType
- Dynamic filters per draft.report: Employee (scope.can_pick_employee), Department, Status (report-aware choices), Request type (requests only)
- 4 KPI cards per report from summary; decorative bars aria-hidden
- Table: avatar+name+email employee cell; Actions ⋯ → View → /requests/:id or /timesheets/:id; disabled for attendance/employees (no detail route)
- No sortable headers (reports API has no ordering) | pagination outside card | PAGE_SIZE=15

### KNOWN_CONSTRAINTS
- Export uses applied filters only
- Employee filter hidden when can_pick_employee=false (employee role sees own scope only)
- Inverted date range → 400 surfaced via ErrorAlert; never swapped

### CHANGE_LOG
- 2026-10-12 | redesigned reports page: custom header + export buttons, labeled filter card w/ Clear/Apply, per-report KPI cards w/ decorative bars, styled table w/ avatar employee cell + actions col, external pagination; i18n EN/AR
