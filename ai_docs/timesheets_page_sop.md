# Timesheets Page Redesign — Developer SOP

## Purpose & business context
The Timesheets list page (`/timesheets`) was redesigned to match the provided
"Modern Timesheets Dashboard UI" reference: a professional filter panel, four
status summary cards, a richer table, and compact pagination. All data remains
real — every filter maps to an existing `GET /api/timesheets/` parameter and
the backend scope (`scope_items`) is untouched.

## Files changed (2026-10-12)
- `frontend/src/features/timesheets/list.tsx` — full redesign (only file rewritten).
- `backend/apps/timesheets/views.py` — `ordering_fields` gained `submitted_at`
  (safe config change; enables the SUBMITTED ON sort).
- `frontend/src/i18n/en.json` / `ar.json` — new `timesheets.*` keys
  (filters/summary/action labels) and `pagination.page_one` plural form.

## What was built
- **Header**: existing `PageHeader` + red `+ New timesheet` button (44px, r=10px)
  → `/timesheets/new` (unchanged create flow).
- **Filter panel**: white card, labels above controls, 44px/10px-radius inputs.
  Status select (all six backend statuses), Date range preset select
  (All time / This week / Last week / Last 4 weeks / This month / Last month)
  resolved to `week_from`/`week_to`, Employee select (calendar/person icon
  adornments), `Clear` (outlined) + `Apply` (red, funnel icon).
  Draft vs applied state: edits never refetch until Apply.
  `Awaiting my review` checkbox preserved for MANAGER/HR (`pending_review`).
- **Summary cards**: Total (pale red), Approved (pale green), Pending
  (pale amber, = PENDING + IN_REVIEW), Rejected (pale blue). Values are
  per-status `count` queries (`page_size=1`) that apply every filter EXCEPT
  `status` — the cards are the status breakdown of the filtered set.
- **Table**: `WEEK STARTING (SUNDAY)` — per project rule the Sun–Sat business
  week is shown even though `week_start` is stored as the Monday key
  (`businessWeek()` maps Monday → Sunday..Saturday). Employee cell = avatar
  initial + display name (from `/api/reports/scope/` scoped name map) + email.
  Hours use shared `useFormatDuration` (40h / 8h 30m / 45m). STATUS uses the
  existing `StatusBadge`. SUBMITTED ON shows date + muted time. Sortable
  headers: week_start, status, submitted_at (API `ordering`); EMPLOYEE and
  HOURS intentionally have no sort affordance (not supported by the API).
- **Actions**: bordered three-dot icon → menu with View details (always),
  Review (row's `current_actor_role` === user role and status
  PENDING/IN_REVIEW), Resubmit (own + RETURNED). All items navigate to the
  detail page, where the server-provided `actions` list gates real workflow
  buttons — nothing new is authorized from the list.
- **Pagination**: "Page X of Y (N items)" left (singular added via
  `pagination.page_one`); prev/next chevron circles + numbered circle buttons
  (current in CDS red), 5-page window, chevrons mirrored in RTL.
- **States**: `CardSkeleton`+`TableSkeleton` while loading; `EmptyState` inside
  the table card distinguishes "no timesheets" (New CTA) from "no filter
  results" (Clear filters CTA); `ErrorAlert` on API failure.

## Impact analysis
- DB schema: none. Existing data: none. Accounting/stock: n/a.
- Backend: one additive ordering field — no behavior change.
- Security: unchanged; employee picker reuses the already-scoped
  `/api/reports/scope/` payload (`can_pick_employee` = MANAGER/HR only).
- i18n: new keys added for EN + AR; plural `page_one` improves all
  `pagination.page` callers.
- Multi-company: n/a (single-org app; scoping is role-based).

## Integration points
- `AttendanceControl` already invalidates `["timesheets"]`/`["timesheet"]`
  query keys — list refreshes after check-in/out.
- Row click and every menu item navigate to `/timesheets/:id`.

## Test scenarios
- Happy path: list loads; Apply filters narrows table; cards reflect the
  period/employee filter; sort toggles reorder rows; row/menu → detail.
- Edge cases: empty result with filters → Clear filters CTA; zero state →
  New timesheet CTA; weeks on month boundaries display Sun–Sat spans.
- Permissions: EMPLOYEE sees no Employee filter and only own rows; MANAGER
  sees self + direct reports and the "Awaiting my review" checkbox; Review
  menu item only appears when the row's actor role matches the user role.

## Known limitations / deferred
- Date range is preset-based (no free-form two-date picker) — matches API's
  week-granular `week_from`/`week_to` and keeps one control like the reference.
- Sort icons exist only on API-sortable columns (no fake affordances).
- Employee column falls back to email if the submitter is outside the
  report-scope name map (shouldn't happen — scopes mirror each other).

## Update 2026-10-12 — Pagination placement
- The pagination row was moved outside the table `Card`. The bordered card now ends immediately after the last data row; pagination renders as a sibling `Box` ~18px below (`mt: 2.25`), full content width, count text left / circular controls right (mirrored in RTL). Current page stays CDS red; prev/next disabled states unchanged. Driven by the same `page` state / `data.count` API pagination — no logic change.
