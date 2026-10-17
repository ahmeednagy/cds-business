# Feature Specification: HR Reports

**Feature Branch**: `002-reports`

**Created**: 2026-10-06

**Status**: PARTIAL — feature implemented and live (all four reports, filters,
scope enforcement, XLSX/PDF export, EN/AR RTL UI), but the planned backend/
frontend test suites and print stylesheet were never delivered (see open tasks
in `tasks.md`).

**Input**: User description: "Reports module for the CDS Business HR platform: Attendance, Timesheet, Requests, and Employee Summary reports with date-range/employee/department/status/request-type filters, role-scoped data (least-privilege), Excel/PDF export, print, EN/AR localization with RTL, CDS red/gray design, responsive UI, and full loading/empty/validation/error/export states — with backend and frontend tests."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a Scoped Report On Screen (Priority: P1)

An authenticated user (Employee, Manager, or HR) opens the Reports section from the
sidebar, picks a report (Attendance, Timesheets, Requests, or Employee Summary),
optionally sets filters (date range, employee, department, status, request type),
and sees a paginated results table plus summary metrics computed over the whole
filtered result — not just the visible page. The data shown is exactly what the
user's role is permitted to see: an employee sees only their own data, a manager
sees their own plus direct reports' data, and HR sees organization-wide attendance
plus only the requests/timesheets that pass through an HR workflow step.

**Why this priority**: The on-screen report is the core value. Everything else
(export, print) is a rendering of the same filtered, scoped dataset.

**Independent Test**: Log in as the demo manager, open Reports → Requests, apply a
date range and status filter, and confirm the table and summary reflect only
requests inside the manager's scope. Repeat as employee (self only) and HR
(HR-step items + org attendance only).

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they open the sidebar, **Then** a Reports
   navigation item is visible and leads to the Reports page.
2. **Given** the Reports page, **When** the user switches report type, **Then**
   the table columns, available filters, and summary metrics update to match the
   selected report.
3. **Given** a selected report, **When** the user applies a Date From/Date To
   range and generates, **Then** every row shown falls inside the range and the
   summary aggregates the full filtered set.
4. **Given** a manager on any report, **When** they open the Employee filter,
   **Then** the choices contain only the manager and their direct reports.
5. **Given** an employee on any report, **Then** results contain only their own
   records and no employee picker is needed beyond "self".
6. **Given** an HR user, **When** they run the Requests or Timesheets report,
   **Then** the results contain only items whose workflow includes an HR review
   step (plus HR's own items) — never a blanket org-wide item list; the Employee
   Summary and Attendance reports provide the authorized org-wide view.
7. **Given** a report with no matching rows, **When** it renders, **Then** an
   explicit empty state is shown instead of a blank table.
8. **Given** a running report request, **When** results have not yet arrived,
   **Then** a loading state is shown; on failure an API error state with a safe
   message is shown (no internals).

---

### User Story 2 - Filter Validation and Reset (Priority: P1)

A user entering an invalid filter combination — e.g., Date To earlier than Date
From, an employee outside their permitted scope, or a status the report does not
support — receives a clear validation error identifying the offending filter, and
no fabricated or silently-corrected results. A Reset action clears all filters
back to the report's defaults.

**Why this priority**: Trust in HR reporting depends on the system rejecting bad
input rather than quietly returning misleading data. Equal priority with Story 1
because a report that silently corrects inputs is worse than no report.

**Independent Test**: Submit Date From = 2024-06-10, Date To = 2024-06-01 and
confirm a validation error is surfaced; then hit Reset and confirm the default
report reloads.

**Acceptance Scenarios**:

1. **Given** any report, **When** Date To precedes Date From, **Then** the request
   is rejected with a validation error naming the date fields — no rows, no
   silent swap.
2. **Given** a malformed date, non-integer employee id, or unsupported status
   value, **When** the report runs, **Then** a validation error identifies the
   field.
3. **Given** a manager filtering by an employee who is not a direct report,
   **When** the report runs, **Then** a validation error rejects the employee
   filter (out-of-scope employees are never silently included or leaked).
4. **Given** any applied filters, **When** the user clicks Reset, **Then** all
   filters clear and the report regenerates unfiltered.
5. **Given** filters applied, **When** the user re-runs the report, **Then** the
   summary and table refresh from current data (no stale cache).

---

### User Story 3 - Export and Print What You See (Priority: P2)

A user exports the current report — with the same active filters and the same
authorization scope — as an Excel workbook or a PDF document, or prints it.
Exports carry CDS Business branding, a title, the applied filters, generation
timestamp, summary section, and correctly rendered Arabic text (shaped, right-to-left)
when the UI language is Arabic. If the result exceeds the export row limit, the
export is rejected with a message telling the user to narrow filters — never a
truncated file presented as complete.

**Why this priority**: Exports are how reports leave the system (payroll review,
management packs, audits). They are P2 because on-screen reporting must land
first, and because exports are meaningless without the filter/RBAC fidelity of
Stories 1–2.

**Independent Test**: As a manager, filter the Requests report to one type and a
date range, export XLSX and PDF, print the page, and confirm all three contain
exactly the filtered, in-scope rows with branding and (for Arabic UI) correct
Arabic shaping and RTL layout.

**Acceptance Scenarios**:

1. **Given** a filtered report on screen, **When** the user exports Excel,
   **Then** the workbook contains exactly the same rows (all filtered rows, not
   just the visible page) plus a summary sheet, with RTL sheet direction when the
   UI language is Arabic.
2. **Given** a filtered report, **When** the user exports PDF, **Then** the
   document shows the report title, applied filters, generation timestamp,
   summary table, and the full filtered row set — with Arabic text correctly
   shaped and ordered when the UI language is Arabic.
3. **Given** any report, **When** the user prints, **Then** the printed output
   shows the report content cleanly (title, filters, summary, full table) without
   navigation chrome.
4. **Given** an export request, **When** the filtered result exceeds the export
   row limit, **Then** the export is refused with a clear "narrow the filters"
   message.
5. **Given** an employee, **When** they export any report, **Then** the file
   contains only their own in-scope data — identical scope to the on-screen
   report.
6. **Given** an in-flight export, **When** it is generating or downloading,
   **Then** the export control shows a busy/disabled state to prevent duplicate
   requests.
7. **Given** an unauthenticated or out-of-scope request, **When** an export URL
   is hit directly, **Then** it is rejected exactly as the JSON report would be.

---

### User Story 4 - Localized, Responsive, Themed Experience (Priority: P2)

The Reports UI works identically in English and Arabic: all labels, table
headers, statuses, filter labels, and exported documents localize; Arabic renders
the entire page right-to-left. The page is usable on desktop, tablet, and mobile,
and respects the app's light/dark theme. Statuses shown to users are localized
display labels while internal status values stay unchanged end-to-end.

**Why this priority**: The platform's audience is bilingual EN/AR; a report that
mangles Arabic in the UI or the PDF is a broken feature for half the audience.
P2 because it rides on the same screens as Stories 1–3.

**Independent Test**: Switch to Arabic, re-run a report, export a PDF, and confirm
RTL layout plus legible Arabic glyphs; toggle dark theme and confirm contrast;
narrow the viewport to mobile width and confirm the filters/table remain usable.

**Acceptance Scenarios**:

1. **Given** Arabic selected, **When** the Reports page renders, **Then** layout,
   table, and filters are fully RTL and all strings are Arabic.
2. **Given** request statuses, **When** displayed anywhere (table, summary,
   export), **Then** internal values map to labels: PENDING → Pending/في الانتظار,
   APPROVED → Approved/تمت الموافقة, REJECTED → Rejected/مرفوض,
   WITHDRAWN → Cancelled/تم الإلغاء (and IN_REVIEW → In Review/قيد المراجعة,
   RETURNED → Returned/معاد للتصحيح); API payloads keep internal values.
3. **Given** dark theme, **When** the Reports page renders, **Then** text,
   tables, and status colors remain legible.
4. **Given** a mobile-width viewport, **When** the Reports page renders, **Then**
   filters remain operable and the table adapts (scroll/stack) without breaking
   layout.

---

### User Story 5 - Attendance and Timesheet Business Rules (Priority: P1)

The Attendance report is built from real check-in/check-out sessions grouped per
employee per day — first check-in, last check-out, worked duration, session
count, and a PRESENT/IN_PROGRESS status. The Timesheet report uses real weekly
timesheets and preserves the CDS business week: weeks run Sunday-to-Saturday and
are keyed by the contained Monday (`week_start`); the report displays the
Sunday–Saturday span. Because the platform has no schedule/contract-hours source
of truth, required hours, differences, lateness, and overtime are shown as
explicitly unavailable — never invented.

**Why this priority**: Fabricated HR numbers are a correctness defect, not a
polish issue. Honest "unavailable" markers are a functional requirement.

**Independent Test**: Check in/out as a demo employee, run the Attendance report,
and confirm the day's row matches the real session data; run the Timesheet report
and confirm the displayed week span is Sunday→Saturday for a Monday `week_start`;
confirm required/overtime/late metrics render as unavailable.

**Acceptance Scenarios**:

1. **Given** two attendance sessions in one day, **When** the Attendance report
   runs, **Then** the day row shows first check-in, last check-out, summed worked
   hours, session count = 2.
2. **Given** an open session (no check-out), **When** the Attendance report runs,
   **Then** the row status is IN_PROGRESS.
3. **Given** a timesheet with `week_start` Monday 2024-06-03, **When** the
   Timesheet report runs, **Then** the displayed week spans Sunday 2024-06-02 →
   Saturday 2024-06-08.
4. **Given** no schedule configuration exists, **When** any report shows required
   hours/overtime/lateness, **Then** the value is an explicit "unavailable"
   indicator, not a number.

---

### Edge Cases

- Empty result set for a valid filter combination → explicit empty state, empty
  summary, and exports still succeed with headers + "no rows" (or the export is
  permitted with zero data rows).
- Report data changes mid-session → each Generate run re-queries; no stale
  cached report presented as current.
- Very large result set → on-screen report is paginated; exports are row-capped
  with a clear refusal message instead of a truncated file.
- An employee's manager changes → report scopes follow the live reporting line
  at query time, not a snapshot.
- Employee without a profile/department → rows still render (empty department),
  and the employee can still appear in their manager's scope.
- Export requested with an unsupported format → validation error.
- Statuses grouped in summaries (e.g., all in-flight states under "Pending")
  must never overwrite the per-row internal status.

## Requirements *(mandatory)*

### Functional Requirements

**Reports & data**

- **FR-001**: The system MUST provide four reports — Attendance, Timesheets,
  Requests, and Employee Summary — selectable from a single Reports section.
- **FR-002**: Every report MUST derive its rows exclusively from real platform
  data: attendance sessions, weekly timesheets, requests, and employee profiles.
  No report field may be synthesized where no source data exists.
- **FR-003**: The Attendance report MUST group attendance sessions per employee
  per work date and show first check-in, last check-out, total worked hours,
  session count, and status (PRESENT when all sessions closed, IN_PROGRESS when
  any session is open).
- **FR-004**: The Timesheet report MUST preserve the Sunday-to-Saturday business
  week: a timesheet's `week_start` (the contained Monday) MUST be displayed as a
  Sunday→Saturday span.
- **FR-005**: Where source data does not exist for required hours, hour
  differences, lateness, or overtime, the reports MUST display an explicit
  "unavailable" indicator (and the API MUST expose availability flags) rather
  than a numeric estimate.
- **FR-006**: The Employee Summary report MUST show per-employee consolidated
  metrics — attendance days, worked hours, session count, timesheet counts
  (total/approved), logged hours, and request counts by outcome (total, pending,
  approved, rejected, cancelled) — each metric computed only over data the
  caller may see.
- **FR-007**: Each report MUST return summary aggregates computed over the entire
  filtered result set, independent of pagination.

**Filtering**

- **FR-008**: Reports MUST support these filters server-side: Date From, Date To,
  Employee, and — where the report supports them — Department, Status, and
  Request Type. Attendance supports status PRESENT/IN_PROGRESS; Timesheets and
  Requests support the workflow statuses; Requests additionally supports Request
  Type; Employee Summary supports employee/department/date-range only.
- **FR-009**: An inverted date range (Date To before Date From) MUST be rejected
  with a validation error identifying the field; malformed dates, non-integer
  ids, and unsupported statuses MUST likewise produce field-specific validation
  errors.
- **FR-010**: An employee filter value outside the caller's reporting scope MUST
  be rejected with a validation error — never silently applied or widened.
- **FR-011**: The UI MUST provide a Reset action clearing all filters, and a
  Generate/Refresh action that re-runs the report against current data.

**Authorization**

- **FR-012**: Report visibility MUST be enforced server-side and MUST reuse the
  platform's existing authorization scopes: Employee → own records; Manager →
  own + direct reports resolved on the live reporting line; HR → organization-wide
  attendance, own items, and items whose workflow assigns an HR step. No
  endpoint may grant HR (or any role) blanket item-level visibility beyond that
  model.
- **FR-013**: Export endpoints MUST apply exactly the same scope and filters as
  the corresponding on-screen report — an export can never contain a row the
  caller could not see on screen.
- **FR-014**: The system MUST expose the caller's permitted filter vocabulary
  (visible employees, departments, request types) so the UI offers only valid
  choices; this vocabulary MUST itself be scope-filtered.
- **FR-015**: Unauthenticated access to any report or export endpoint MUST be
  rejected; the forced-password-change gate applies to report endpoints as to
  all others.

**Exports & print**

- **FR-016**: Each report MUST export to Excel (.xlsx) and PDF, containing the
  report title, applied filters, generation timestamp, the full filtered row
  set, and a summary section.
- **FR-017**: Exports MUST carry CDS Business branding and MUST render correctly
  in both languages: Arabic text in PDFs MUST be glyph-shaped and
  right-to-left-ordered; Excel sheets for Arabic reports MUST be marked
  right-to-left.
- **FR-018**: Exports MUST be size-capped server-side; exceeding the cap MUST
  produce a clear error instructing the user to narrow filters.
- **FR-019**: The Reports page MUST support printing the current report —
  title, filters, summary, and rows — rendered cleanly without application
  chrome.
- **FR-020**: Export controls MUST show a busy/disabled state while an export is
  being generated.

**Presentation**

- **FR-021**: A Reports navigation item MUST appear in the application sidebar
  for all authenticated roles.
- **FR-022**: The Reports page MUST present: report selection, a reusable filter
  bar, summary metric cards, and a paginated results table, in the CDS red/gray
  design language, in both light and dark themes.
- **FR-023**: The page MUST implement distinct loading, empty, validation-error,
  and API-error states with safe, actionable messages.
- **FR-024**: The page MUST be fully localized in English and Arabic with
  complete RTL layout for Arabic, and responsive across desktop, tablet, and
  mobile viewports.
- **FR-025**: Workflow statuses MUST keep internal values in API payloads and be
  rendered with localized display labels: PENDING → Pending/في الانتظار,
  APPROVED → Approved/تمت الموافقة, REJECTED → Rejected/مرفوض,
  WITHDRAWN → Cancelled/تم الإلغاء, IN_REVIEW → In Review/قيد المراجعة,
  RETURNED → Returned/معاد للتصحيح. Summary groupings may aggregate in-flight
  statuses under "Pending" but MUST NOT alter per-row status values.

**Quality**

- **FR-026**: Backend report builders and endpoints MUST be covered by automated
  tests: happy path per report, per-role scope isolation, every filter,
  inverted-range rejection, aggregation correctness, both export formats,
  export scope parity, and row-cap refusal.
- **FR-027**: Frontend MUST be covered by automated tests for report rendering,
  switching report types, applying/resetting filters, loading/empty/error
  states, export action behavior, and EN/AR rendering.

### Key Entities

- **Report (logical)**: A named, parameterized view over platform data —
  identified by report type, defined by its row shape, supported filters,
  summary metrics, and export renderings. Not persisted.
- **Report Filters**: The caller-supplied parameter set — date range, employee,
  department, status, request type, language — validated server-side and echoed
  back as "applied filters" in results and exports.
- **Report Scope**: The caller's permitted data envelope for reporting, derived
  from their role and live reporting line; identical to the existing item/attendance
  authorization scopes.
- **Report Row**: A single result line — per employee-day (Attendance), per
  timesheet (Timesheets), per request (Requests), or per employee (Employee
  Summary) — carrying display fields plus internal status values.
- **Report Summary**: Aggregates (counts, totals, status breakdowns) over the
  full filtered scope, computed alongside — not from — the paginated rows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open Reports, select a report, apply filters, and see
  scoped results in under 30 seconds for the common path.
- **SC-002**: 100% of report rows returned to any role are rows that role could
  already access item-by-item (zero out-of-scope rows in tests and review).
- **SC-003**: Every invalid filter input tested (inverted range, malformed date,
  out-of-scope employee, unsupported status, bad export format) returns a
  field-specific validation error — 0 cases of silent correction or 500s.
- **SC-004**: Exported XLSX/PDF row sets match the on-screen filtered row set
  exactly (verified by row-count and id-set comparison in tests) for all four
  reports.
- **SC-005**: Arabic PDF exports render shaped, RTL-ordered Arabic text (visual
  check + no unshaped logical-order glyphs); the Arabic UI passes an RTL layout
  check.
- **SC-006**: All report and export endpoints respond within 2 seconds on the
  demo dataset, and the Employees report does not issue per-row queries
  (constant query count as scope size grows, verified in tests).
- **SC-007**: Backend and frontend report test suites pass in CI/locally with
  zero regressions in existing platform tests.

## Assumptions

- Reports are available to all three roles; authorization is expressed through
  data scope, not a separate "can view reports" permission. The Employees report
  for an Employee role shows a single self row — acceptable and consistent.
- "Print" means printing the on-screen report via the browser's print pipeline
  with a print-appropriate rendering of the current table — not a separate
  server-generated print document.
- Report filters are optional; running a report with no filters returns the
  caller's full scope (paginated on screen, capped on export).
- Export row caps (≈50k rows Excel, ≈2k rows PDF) are acceptable limits chosen
  to keep request-path generation safe; exceeding them asks the user to narrow
  filters.
- The refresh/language of exports follows the `lang` parameter supplied with the
  export request, matching the UI language the user chose.
- No new persisted entities are required — reports are computed views over
  existing attendance, timesheet, request, and user data.
- The existing `apps/reports/` backend is treated as candidate implementation to
  be verified against this spec via tests, not as ground truth — where it
  conflicts with the spec, the spec wins.
