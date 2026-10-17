# Tasks: HR Reports

**Status note (2026-10-16 audit)**: The reports feature was **implemented**
(report builders, scope endpoint, XLSX/PDF exports, localized Reports page with
Generate/Clear/export controls are all live) but the planned **test and
verification tasks were never executed** — checkboxes were corrected during the
audit to reflect verified reality. Open items: dedicated report tests
(T002/T003/T016/T020), frontend report tests (T010/T012/T018), the export
filter-names fix (T004), client-side date guard (T011), print stylesheet
(T015), N+1 (T022), and the full verification passes (T023–T025).

**Input**: Design documents from `/specs/002-reports/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Required — FR-026/FR-027 mandate backend + frontend coverage.

**Classification legend** (from plan.md gap analysis):
- **[EXISTS]** — already implemented in `apps/reports/`; do not rewrite
- **[VERIFY]** — exists, must be proven by the new tests before being marked done
- **[FIX]** — small correction to existing code
- **[NEW]** — missing, requires implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline the existing backend before building on it

- [x] T001 Confirm Docker stack healthy and capture a baseline of the existing endpoints: `GET /api/reports/{attendance,timesheets,requests,employees}/`, `/api/reports/scope/`, `/api/reports/{key}/export/?fmt=xlsx|pdf` per role (employee/manager/hr demo users) — record row counts per role as the isolation baseline [EXISTS → VERIFIED live during spec phase; keep as regression anchor]

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend contract verification + shared frontend scaffolding that EVERY user story builds on. No report UI work may merge without the scope tests proving the reused backend honors FR-012/FR-013.

- [ ] T002 [VERIFY] Write `backend/tests/integration/test_reports.py` using `tests/factories.py` + `auth_client` fixture: happy path per report (all four return `{count,results,summary,meta}`), each filter (`date_from`/`date_to`/`employee`/`department`/`status`/`request_type`) applies server-side, `date_to<date_from` → 400 `validation_error`, malformed date/non-integer employee/unsupported status → 400, per-report summary aggregates computed over full filtered set (not just page), pagination envelope intact (FR-002…FR-011)
- [ ] T003 [P] [VERIFY] Write `backend/tests/permissions/test_reports_scope.py`: EMPLOYEE sees only own rows in all four reports + scope endpoint (`can_pick_employee=false`, only self in `employees[]`); MANAGER sees self+direct reports, filtering `employee=` to a non-report → 400; HR sees org-wide attendance + employees but only `requires_hr_review` requests/timesheets (+own); unauthenticated → 401; export endpoints enforce identical scope (id-set parity with JSON report) for all roles; exports reject bad `fmt` (FR-012…FR-015, FR-018)
- [ ] T004 [FIX] In `backend/apps/reports/views.py` `ReportExportView.get`, resolve `employee_names`/`request_type_names` maps (from `visible_employees` + `RequestType`) and pass them to `exports.build_xlsx`/`build_pdf` so the Filters line renders names, not raw ids (existing `exports._filters_text` already accepts the maps)
- [x] T005 [P] [NEW] Add `reports.*` i18n keys to `frontend/src/i18n/en.json` and `frontend/src/i18n/ar.json`: nav label, report titles (attendance/timesheets/requests/employees), filter labels (dateFrom/dateTo/employee/department/status/requestType), actions (generate/reset/exportExcel/exportPdf/print), summary metric labels, states (empty/loading/exportTooLarge), `unavailable` (—) label, print header labels (filters/generatedAt); Arabic values per spec status map (WITHDRAWN→تم الإلغاء etc.)
- [x] T006 [P] [NEW] Add report types to `frontend/src/types/index.ts`: `ReportKey`, `ReportScope`, `ReportPage<T> = Page<T> & {summary, meta}`, row interfaces `AttendanceRow`, `TimesheetRow`, `RequestRow`, `EmployeeSummaryRow` matching `data-model.md`
- [x] T007 [NEW] Wire navigation: add `{path:"/reports", element:<ReportsPage/>}` in `frontend/src/routes/index.tsx` (inside authed Layout children, all roles), add Reports sidebar item (`nav.reports` key, `AssessmentOutlinedIcon` or similar) to `items` in `frontend/src/components/Layout.tsx`, add `["/reports","nav.reports"]` to `SECTION_TITLES` — visible for all authenticated roles (FR-021)

---

## Phase 3: User Story 1 - Run a Scoped Report On Screen (Priority: P1)

**Goal**: Authenticated users of any role open Reports, pick one of four reports,
apply filters, and see a paginated scoped table + full-scope summary.

**Independent Test**: `quickstart.md` V1–V3, V7 — per-role scope and empty state
visible in the browser at `http://localhost:5173/reports`.

- [x] T008 [US1] [NEW] Create `frontend/src/features/reports/config.ts`: report registry keyed by `ReportKey` — per report: i18n title key, column definitions `{key, labelKey, align, render}` (dates via `i18n.language` locale; statuses via `StatusBadge`; null/`available:false` metrics render `t("reports.unavailable")`), supported filter flags `{date,employee,department,status,requestType}` mirroring `REPORTS` on the backend, summary metric descriptors `{key,labelKey}` — driven from `data-model.md` row shapes (FR-001, FR-022)
- [x] T009 [US1] [NEW] Create `frontend/src/features/reports/index.tsx` (`ReportsPage`): report selector (tabs or select); draft-vs-applied filter state — inputs edit draft, **Generate** copies draft→applied and feeds TanStack Query key `["report",key,applied,page]`; **Reset** clears both; `FilterBar` renders only the filters the report supports; Employee/Department/RequestType options come from `GET /api/reports/scope/` (`can_pick_employee` gates the employee select); results table (`TableContainer` with horizontal scroll on mobile, `minWidth` per config); summary metric cards row; `PaginationControls`; `TableSkeleton`/`EmptyState`/`ErrorAlert` for loading/empty/error (FR-007, FR-008, FR-011, FR-014, FR-022…FR-024)
- [ ] T010 [P] [US1] [NEW] Write `frontend/tests/reports.test.tsx` (Vitest + Testing Library, mocking `src/lib/api` like `tests/attendance.test.tsx`): page renders report selector + four reports; switching report swaps columns/filters; manager scope shows employee picker with scoped options, employee scope hides it; rows render from mocked payload; loading skeleton + empty state render (FR-022)

---

## Phase 4: User Story 2 - Filter Validation and Reset (Priority: P1)

**Goal**: Invalid filter input produces field-specific validation errors and
never silently corrected data; Reset restores defaults.

**Independent Test**: `quickstart.md` V5–V6 — inverted range rejected, Reset
clears.

- [ ] T011 [US2] [NEW] In `frontend/src/features/reports/index.tsx`: client-side guard for `date_to < date_from` (inline `helperText` error, no request fired); map backend `validation_error` `details` keys (`date_to`, `employee`, `status`, …) onto the matching filter controls' `error`/`helperText`, falling back to `ErrorAlert`; ensure Generate always re-queries (include applied-state object identity in query key, no stale cache) (FR-009…FR-011, FR-023)
- [ ] T012 [P] [US2] [NEW] Extend `frontend/tests/reports.test.tsx`: Generate applies draft filters to the request params; Reset clears fields and refetches unfiltered; backend `validation_error` with `details.date_to` marks the Date To field; inverted range shows client error and does not call the API (FR-009, FR-011)

---

## Phase 5: User Story 3 - Export and Print What You See (Priority: P2)

**Goal**: XLSX/PDF export and print render exactly the current filtered, scoped
report — branded, localized, size-capped, with busy states.

**Independent Test**: `quickstart.md` V8–V10, V16 — exports match on-screen
scope/filters; print preview is clean.

- [x] T013 [US3] [NEW] Add `download` helper to `frontend/src/lib/api.ts`: authorized `fetch` (Bearer + `credentials:"same-origin"`) → `res.blob()`, parses JSON error blobs into `ApiError` on non-OK, else triggers `URL.createObjectURL` anchor download using the `Content-Disposition` filename (FR-013, FR-016)
- [x] T014 [US3] [NEW] In `frontend/src/features/reports/index.tsx` (+`config.ts` filenames if needed): **Excel**/**PDF** buttons call `download(`/api/reports/${key}/export/?fmt=…&lang=${i18n.language}&${appliedParams}`)`; both buttons disabled + spinner while an export is in flight; export errors surface via `ErrorAlert` (incl. row-cap refusal `validation_error`); **Print** button calls `window.print()` (FR-016…FR-020)
- [ ] T015 [US3] [NEW] Print stylesheet in `frontend/src/index.css` (`@media print`): hide AppBar/sidebar/filter bar/export buttons (e.g., `.no-print`/`displayPrint="none"` on those regions), expand table to full width, add a print-only header block on the reports page (report title, applied filters line from `meta.filters`, generated-at timestamp); verify Chrome print preview shows no app chrome (FR-019)
- [ ] T016 [P] [US3] [VERIFY] Covered by T003 scope parity + add export-content assertions in `backend/tests/integration/test_reports.py`: xlsx response content-type + non-empty bytes + `Content-Disposition` filename; pdf starts `%PDF`; employee export contains only own rows (parse xlsx via openpyxl in test); `fmt` missing/invalid → 400; export over cap → 400 `validation_error` (FR-013, FR-016…FR-018)

---

## Phase 6: User Story 4 - Localized, Responsive, Themed Experience (Priority: P2)

**Goal**: Full EN/AR + RTL parity, dark theme, and responsive behavior across
the Reports UI.

**Independent Test**: `quickstart.md` V11–V13 — Arabic UI + Arabic PDF, dark
theme, mobile viewport.

- [x] T017 [US4] [NEW] Verify/complete localization in `frontend/src/features/reports/`: every label/table header/summary card/state message via `t()`; statuses rendered via `StatusBadge` (`status.*` keys already localize EN/AR incl. WITHDRAWN→Cancelled/تم الإلغاء); all layout uses logical props (`ms`/`me`, `marginInlineStart`, `direction`-aware icons) so RTL flips correctly; pass `lang` from `i18n.language` to exports (FR-024, FR-025)
- [ ] T018 [P] [US4] [NEW] Extend `frontend/tests/reports.test.tsx`: render page with i18n switched to `ar` — assert RTL direction applied + Arabic labels present; assert status label mapping renders localized labels while payload keeps internal values; dark-theme render smoke check (FR-024, FR-025)
- [ ] T019 [P] [US4] [VERIFY] Manual/responsive check in `quickstart.md` V13 — table scrolls horizontally on xs, filters stack, no overflow; fix any broken `sx` in `frontend/src/features/reports/index.tsx` (FR-024)

---

## Phase 7: User Story 5 - Attendance and Timesheet Business Rules (Priority: P1)

**Goal**: Attendance aggregates real sessions honestly; timesheets display the
Sun–Sat business week; unavailable metrics are explicit.

**Independent Test**: `quickstart.md` V14–V15 — week span and "—" metrics.

- [ ] T020 [US5] [VERIFY] In `backend/tests/integration/test_reports.py`: attendance report groups multiple sessions per employee-day (first check-in, last check-out, summed worked hours, `sessions` count, `PRESENT`/`IN_PROGRESS`); timesheet row for `week_start`=Monday shows `business_week_start`=Sunday and `week_end`=Saturday; `required_hours`/`difference_hours`/`late_days`/`overtime` are `null` + `*_available:false`; summaries count real fixtures only (FR-003…FR-005)
- [x] T021 [P] [US5] [NEW] In `frontend/src/features/reports/config.ts`: timesheets `week` column renders `businessWeekStart → weekEnd` (Sun–Sat) via locale date formatting; hours columns format 2-decimals; null metrics render `t("reports.unavailable")` (—), never `0` (FR-004, FR-005)

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T022 Add `assertNumQueries` coverage in `backend/tests/integration/test_reports.py` (or `test_query_counts.py` pattern): employees report holds constant query count as scope grows; other reports show no per-row N+1 (constitution VI)
- [ ] T023 Run full verification in Docker: `docker compose exec backend pytest -q`, `docker compose exec frontend npm test`, `docker compose exec backend ruff check .`, `docker compose exec frontend npx tsc -b` — all green, zero regressions
- [ ] T024 Browser-verify `quickstart.md` V1–V16 end-to-end at `http://localhost:5173` across all three demo roles; fix any runtime issues found
- [ ] T025 Update `README.md` reports section if present, and append a CHANGE_LOG line per project `ai_docs` convention if a reports doc exists (check `ai_docs/` first — create only if the convention directory already exists)

---

## Dependencies

- Phase 1–2 (T001–T007) block all stories — scope tests (T003) prove the reused
  backend before the UI is built on it.
- US1 (T008–T010) is the frontend skeleton all other frontend stories extend.
- US2 (T011–T012) extends US1's page. US3 (T013–T016) adds export/print to US1's
  page (independent of US2). US4 (T017–T019) is cross-cutting over the finished
  page. US5 (T020–T021) is backend-verification + column rendering.
- Polish (T022–T025) runs last.

```text
Phase 1–2 → US1 → US2/US3/US5 (parallelizable slices) → US4 → Polish
```

## Parallel Execution Examples

```bash
# Phase 2 (different files):
T003 test_reports_scope.py  ∥  T005 en.json+ar.json  ∥  T006 types/index.ts

# US3 (backend test file vs frontend files):
T016 test_reports.py export assertions  ∥  T013 api.ts download  ∥  T015 index.css print

# US4 (tests vs page):
T018 reports.test.tsx i18n cases  ∥  T019 responsive sx fixes
```

## Implementation Strategy

1. **Foundation first**: T001–T007 — prove the existing backend's scope is
   correct (non-negotiable gate) and land shared scaffolding.
2. **MVP**: US1 — a working, scoped, on-screen Reports page is demo-able alone.
3. **Increment**: US2 (validation), US5 (business rules) — the P1 correctness
   stories; then US3 (export/print) and US4 (i18n/theme/responsive).
4. **Polish**: query-count audit, full suites, browser pass V1–V16.

## Notes

- [P] = different files, no incomplete dependencies
- [USn] labels map to spec.md user stories
- `frontend/src/features/reports/index.tsx` is touched by US1–US4 — sequence
  those within a single worker or merge carefully
- No git commits without explicit user request (constitution workflow rule)
