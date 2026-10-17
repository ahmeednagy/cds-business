# Reports Page — Developer SOP

## Purpose
`/reports` provides four scoped, exportable reports (Attendance, Timesheets,
Requests, Employee Summary). The page was restyled to the CDS reference
design: labeled filter card, four KPI cards, polished table, pagination
outside the card. All data, filters, scoping, and export logic are the
existing backend services — unchanged.

## Frontend structure (frontend/src/features/reports/index.tsx)
- Header: custom block; right side = two 50px outlined buttons (XLSX with
  download icon, PDF with document icon) calling the existing
  `/api/reports/<report>/export/?fmt=…` endpoint with applied filters.
- Filter card: flex-wrap row of labeled 50px controls —
  Report | From | To | [Employee] | [Department] | [Status] | [Request type] |
  Clear | Apply. Fields use draft state; Apply commits; Clear resets filters
  but keeps the selected report. Changing the draft report clears
  status/request-type (not valid across reports).
- Dynamic filters: Employee appears only when `scope.can_pick_employee`;
  Department only when scope returns departments; Status choices switch per
  report (attendance → PRESENT/IN_PROGRESS, employees → none); Request type
  only for the requests report.
- KPI row: four equal cards per report, driven by `data.summary`:
  - attendance: Total Worked (h), Active Days, Sessions, Employees
  - timesheets: Timesheets, Logged Hours, Approved, Pending (group)
  - requests: Total, Approved, Pending, Rejected (by_status_group)
  - employees: Employees, Total Worked, Logged Hours, Requests
  Decorative mini-bars are aria-hidden, low-opacity ornaments.
- Table: `Card` 16px radius, `#F7F8F9` uppercase header, ~72px rows,
  avatar+name+email employee cell, semantic status pills (PRESENT green,
  IN_PROGRESS amber, workflow statuses via StatusBadge), Actions column.
- Actions: ⋯ menu with "View details" → `/requests/:id` or `/timesheets/:id`.
  Disabled for attendance/employee-summary rows (no detail route exists).
- Pagination outside the card (`mt: 2.25`), count left, circular controls
  right, CDS-red current page, RTL-mirrored.

## Backend
No changes — `filters.py` (validation incl. inverted-range 400),
`services.py` (scoped builders), `views.py` (paginated + export endpoints)
are reused as-is.

## Test scenarios
- Happy: each report loads; filters Apply/Clear; exports download with the
  same filters; KPI values match summary payload.
- Edge: empty result → EmptyState; employees report has no status filter;
  `date_to < date_from` → 400 error surfaced.
- Permission: employee role sees own scope, no Employee picker; manager sees
  team scope; HR unchanged least-privilege.

## Known limitations
- No server-side sorting on report endpoints → no sortable headers.
- Attendance/employee-summary rows have no detail page → actions disabled.
- required_hours / late_days / overtime remain "unavailable" upstream and are
  intentionally not shown as KPIs.
