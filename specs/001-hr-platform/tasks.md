---

description: "Task list for CDS Business HR Platform implementation"
---

# Tasks: CDS Business HR Platform

**Input**: Design documents from `/specs/001-hr-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: INCLUDED — constitution Principle IX mandates happy-path, edge-case, and
permission/security tests per feature; quickstart V5 requires a permission matrix suite.

**Organization**: Tasks grouped by user story (US1–US9 from spec.md) for independent
implementation and testing.

**Module map** (requested phase organization → actual phase/US below):

| Module | Phases |
|---|---|
| Authentication & Accounts | Phase 2 (T008–T010) + US1 (T020–T028); self-service reset post-spec |
| Employees & Profiles | T008 + US2 (T029–T032) + US8 admin (T056–T059) |
| RBAC & Organization | T010, T012 + permission matrix tasks across phases |
| Attendance | post-spec impl (`apps/attendance`, `features/attendance`, `test_attendance.py`) — no dedicated tasks existed; covered by US9 dashboards + reports |
| Timesheets | US6 (T048–T051) |
| Requests & Workflows | US3–US5 (T033–T047), workflow engine T015–T016 |
| Notifications backend | T014 + US7 (T052–T055); UX in `002-notifications` |
| Dashboard / Core App UX | US9 (T060–T063) + Phase 14 (U001–U014) |
| Reports & Exports | Phase 13 (RT001–RT025) |
| Integration / QC | Phase 12 polish (T064–T070) + RT022–RT025 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US9)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create repository structure per plan.md: `backend/`, `frontend/`, `deploy/`, `media/` (media at root, NOT web-served)
- [x] T002 [P] Scaffold Django project in `backend/` (`config/` settings split base/dev/prod, `apps/` package layout per plan.md)
- [x] T003 [P] Scaffold frontend in `frontend/`: Vite + React 18 + TypeScript 5, Tailwind CSS, shadcn/ui init
- [x] T004 [P] Create `backend/requirements.txt` pinning Django 5.x, djangorestframework, djangorestframework-simplejwt, psycopg, django-filter, pytest, pytest-django, factory_boy, gunicorn — plus lint config (ruff)
- [x] T005 [P] Add frontend dependencies in `frontend/package.json`: @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, react-router-dom, vitest, @testing-library/react — plus eslint config
- [x] T006 Create `deploy/docker-compose.yml` (services: db postgres:16 w/ named volume, backend gunicorn, frontend build, nginx), `deploy/Dockerfile.backend`, `deploy/Dockerfile.frontend`, `deploy/nginx/nginx.conf` (proxy `/api/`→backend, `/`→SPA, NO media location)
- [x] T007 [P] Create `backend/pytest.ini` + `backend/tests/conftest.py` base fixtures and `frontend/vitest.config.ts` + test setup file

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create `User` model in `backend/apps/accounts/models.py`: email login (USERNAME_FIELD), `role` choices exactly `EMPLOYEE|MANAGER|HR`, `is_active`, `must_change_password` Boolean, `manager` self-FK (null) with no-cycle validation; `EmployeeProfile` OneToOne with editable/HR-managed field split per data-model.md
- [x] T009 Implement auth endpoints in `backend/apps/accounts/views.py` + `serializers.py`: `POST /api/auth/login/` (generic failure — FR-004), `POST /api/auth/refresh/` (rotating refresh in HttpOnly/Secure/SameSite=Lax cookie), `POST /api/auth/logout/`, `POST /api/auth/change-password/` (clears must_change_password); SimpleJWT: 15-min access, 1-day refresh
- [x] T010 Implement `must_change_password` gate in `backend/apps/core/permissions.py`: all protected endpoints reject while flag set except login/refresh/logout/change-password
- [x] T011 [P] Configure DRF defaults in `backend/config/settings/base.py`: PageNumberPagination page_size=25 (max page_size 100), custom exception handler returning `{error:{code,message,details?}}` with no internals (FR-041, FR-044), django-filter backend
- [x] T012 [P] Implement role permission classes + object-permission base in `backend/apps/core/permissions.py` (`IsEmployee`/`IsManager`/`IsHR`, `ScopedQuerysetMixin` enforcing self/direct-report/org scopes — FR-006)
- [x] T013 [P] Create `AuditEntry` model + `record()` service in `backend/apps/audit/` (append-only: actor, action, item ref, from/to status, comment, timestamp; no update/delete path — FR-035, FR-037)
- [x] T014 [P] Create `Notification` model + `emit()` helper in `backend/apps/notifications/` (recipient, item ref, message, read_at; never emits for actor's own action — FR-034)
- [x] T015 [P] Create `Workflow` + `WorkflowStep` models in `backend/apps/workflows/models.py` (ordered steps, `actor_role ∈ MANAGER|HR`, `require_comment_on_reject/return`)
- [x] T016 Implement transition engine in `backend/apps/workflows/services.py`: `act(item, actor, action, comment)` validates status + step actor role + manager relationship, applies approve/reject/return/withdraw/resubmit inside `transaction.atomic()`, writes AuditEntry + Notifications in same transaction; status machine per data-model.md (PENDING→IN_REVIEW→APPROVED/REJECTED; RETURNED→PENDING; pending→WITHDRAWN by owner, 409 on race — FR-017..FR-023)
- [x] T017 Create frontend shell in `frontend/src/`: `lib/api.ts` (typed fetch client: Bearer inject, 401→silent refresh→retry), `lib/auth.tsx` (session context, in-memory access token), `routes/` role-gated route tree, login page, base layout
- [x] T018 Create `seed_demo` management command in `backend/apps/core/management/commands/seed_demo.py`: HR/manager/employee demo users, default 1-step manager-approval workflow, one request type
- [x] T019 [P] Create test factories in `backend/tests/factories.py` (User, EmployeeProfile, Workflow, WorkflowStep) + auth api-client fixture in `backend/tests/conftest.py`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sign In and Role-Appropriate Access (Priority: P1) 🎯 MVP

**Goal**: Users authenticate with email+password/JWT, land on role-appropriate views, and
are denied anything outside their role — including direct API calls.

**Independent Test**: One account per role; sign in as each; verify correct landing view
and denial of other roles' areas via UI and direct API (quickstart V1).

### Tests for User Story 1

- [x] T020 [P] [US1] Backend auth tests in `backend/tests/integration/test_auth.py`: login success/failure generic message (FR-004), refresh rotation, expired access rejected, must_change_password gate blocks other endpoints until password changed
- [x] T021 [P] [US1] Permission matrix scaffold in `backend/tests/permissions/test_authz_matrix.py`: every registered endpoint × (anonymous, employee, manager, HR) asserting documented allow/deny — extend per story
- [x] T022 [P] [US1] Frontend login test in `frontend/tests/login.test.tsx`: submit → stores session → routes by role; failed login shows generic error

### Implementation for User Story 1

- [x] T023 [US1] Implement `GET /api/me/` in `backend/apps/accounts/views.py`: `{id, email, role, profile, must_change_password}`
- [x] T024 [US1] Implement role-based post-login routing + per-role landing pages (employee/manager/HR stubs) in `frontend/src/routes/` using auth context; hide disallowed nav (display-only, server remains boundary)
- [x] T025 [US1] Implement session bootstrap in `frontend/src/lib/auth.tsx`: on load attempt silent refresh → restore session or redirect to login
- [x] T026 [P] [US1] Frontend test for forced password change in `frontend/tests/change-password.test.tsx`: must_change_password → redirected to change screen → success clears flag and routes to role landing
- [x] T027 [US1] Implement change-password screen in `frontend/src/features/auth/change-password.tsx`: RHF + zod form (current/new/confirm), posts `/api/auth/change-password/`, then routes to role landing; also reachable from account menu for self-service changes (FR-008)
- [x] T028 [US1] Implement forced-change gate in `frontend/src/routes/`: when `/api/me/` returns `must_change_password`, all app routes redirect to the change-password screen until the flag clears

**Checkpoint**: US1 fully functional — three roles sign in, see only their surface

---

## Phase 4: User Story 2 - Employee Profile Management (Priority: P1)

**Goal**: Employees view/edit their own editable profile fields; HR-managed fields are
read-only; managers can view direct reports.

**Independent Test**: Edit editable fields → persist on reload; PATCH an HR-managed field
→ rejected; another employee's profile → denied (quickstart V2).

### Tests for User Story 2

- [x] T029 [P] [US2] Profile API tests in `backend/tests/integration/test_profiles.py`: editable whitelist persists, HR-managed fields rejected server-side (FR-010), cross-employee access denied (FR-011), manager can read direct report profile

### Implementation for User Story 2

- [x] T030 [US2] Implement `PATCH /api/me/profile/` in `backend/apps/accounts/serializers.py` + views: serializer whitelists employee-editable fields (phone, address, personal_email per data-model.md) for EMPLOYEE callers
- [x] T031 [US2] Implement `GET /api/team/` in `backend/apps/accounts/views.py`: manager's direct reports (profiles + pending-item counts placeholder)
- [x] T032 [US2] Create profile page in `frontend/src/features/profile/`: view + edit form (RHF + zod) with HR-managed fields rendered read-only

**Checkpoint**: US2 independently functional — self-service profile with enforced field split

---

## Phase 5: User Story 3 - Employee HR Requests (Priority: P1)

**Goal**: Employees create requests from active request types (validated per type's
field schema), track status, resubmit returned items, and withdraw pending items.

**Independent Test**: With one configured type, submit → track → resubmit/withdraw cycles
with complete history (quickstart V3 steps 1,3,4).

### Tests for User Story 3

- [x] T033 [P] [US3] Request API tests in `backend/tests/integration/test_requests.py`: create with required-field validation from fields_schema (FR-013), own-list scoping (FR-014), resubmit RETURNED (FR-015/020), withdraw pending → WITHDRAWN immutable (FR-016/023), withdraw after reviewer action → 409
- [x] T034 [P] [US3] Request permission tests added to `backend/tests/permissions/test_authz_matrix.py`: employee cannot read/act on others' requests; detail 404-masks out-of-scope items

### Implementation for User Story 3

- [x] T035 [P] [US3] Create `RequestType` + `Request` models in `backend/apps/requests/models.py`: `fields_schema` JSONField `{key,label,type∈text|number|date|choice,required}`, status choices `PENDING|IN_REVIEW|RETURNED|APPROVED|REJECTED|WITHDRAWN`, `current_step`, `workflow_snapshot` JSONField, indexes `(submitter,status)`/`(status,current_step)`/`submitted_at`
- [x] T036 [US3] Implement request submission service in `backend/apps/requests/services.py`: validate `values` against fields_schema (required + type checks), snapshot workflow steps, set initial PENDING, in-transaction audit + notify first-step actors
- [x] T037 [US3] Implement request endpoints in `backend/apps/requests/views.py` + serializers: `GET /api/requests/` (scoped queryset), `POST /api/requests/`, `GET /api/requests/{id}/` incl. server-computed `actions[]`, `POST .../submit/` (resubmit RETURNED), `POST .../withdraw/`
- [x] T038 [P] [US3] Implement `GET /api/request-types/` (active types for submitters) in `backend/apps/requests/views.py`
- [x] T039 [US3] Create `frontend/src/features/requests/`: request list (status badges), dynamic create form rendering fields_schema via RHF+zod, detail page (status, values, history, available actions from `actions[]`), resubmit + withdraw flows

**Checkpoint**: US3 independently functional — full employee-side request lifecycle

---

## Phase 6: User Story 4 - Secure Attachments on Requests (Priority: P2)

**Goal**: Authorized-only file upload/download on requests — no public URLs.

**Independent Test**: Attach → owner+reviewer download OK; unrelated user and anonymous
get 404/401 including via direct link (quickstart V3 step 2, SC-008).

### Tests for User Story 4

- [x] T040 [P] [US4] Attachment tests in `backend/tests/permissions/test_attachments.py`: authorized download, unauthorized 404-masking, oversize/disallowed-type 400 (FR-030), upload on others' items denied, upload/remove on non-editable parent → 409, removed attachment download → 404, soft-delete retains record (FR-045)

### Implementation for User Story 4

- [x] T041 [US4] Create `Attachment` model in `backend/apps/requests/models.py`: FileField to private `MEDIA_ROOT`, `request` FK (required), `original_name`, `content_type`, `size`, `uploaded_by`, `removed_at` soft-delete marker
- [x] T042 [US4] Implement `POST /api/attachments/` (multipart; MIME allowlist pdf|png|jpg|docx|xlsx|txt, ≤10 MB; 409 unless parent editable), `GET /api/attachments/{id}/` streaming `FileResponse` after parent permission check, and `DELETE /api/attachments/{id}/` (soft-delete `removed_at`, owner + editable parent only) in `backend/apps/requests/views.py`
- [x] T043 [US4] Add attach/remove/download UI to request create+detail in `frontend/src/features/requests/attachments.tsx` (respecting type's `allow_attachments`/`require_attachments`)

**Checkpoint**: US4 functional — zero unauthorized downloads (SC-008)

---

## Phase 7: User Story 5 - Manager Review of Direct Reports' Items (Priority: P2)

**Goal**: Managers see a pending queue for direct reports and approve/reject/return with
comments per workflow.

**Independent Test**: Employee submits → manager queue shows it → approve → status +
audit + employee notified (quickstart V3 steps 4–6, SC-003).

### Tests for User Story 5

- [x] T044 [P] [US5] Review tests in `backend/tests/integration/test_review.py`: queue scoped to direct reports (FR-018), approve/reject/return transitions, comment-required rules, non-report review denied, double-action 409 (FR-021), returned item editable by submitter (FR-020), pending items move to new manager's queue after report reassignment

### Implementation for User Story 5

- [x] T045 [US5] Implement review action endpoints in `backend/apps/requests/views.py`: `POST .../approve|reject|return/` delegating to transition engine (T016); wire `actions[]` to engine's legal-action computation
- [x] T046 [US5] Extend `GET /api/team/` in `backend/apps/accounts/views.py` with live pending-review counts per report
- [x] T047 [US5] Create `frontend/src/features/review/`: pending queue, item review detail (content + history + comment box), approve/reject/return buttons driven by `actions[]`

**Checkpoint**: US5 functional — complete submit→review cycle with audit + notify

---

## Phase 8: User Story 6 - Timesheet Submission and Approval (Priority: P2)

**Goal**: Weekly timesheets with per-day hour entries through the same approval
workflow.

**Independent Test**: Submit week timesheet → duplicate week → 409 → manager approves →
APPROVED read-only (quickstart V4).

### Tests for User Story 6

- [x] T048 [P] [US6] Timesheet tests in `backend/tests/integration/test_timesheets.py`: per-day entries within week, hours ≤24, unique (employee, week_start) → 409 on duplicate (FR-025), full approve/return/resubmit/withdraw cycle, approved read-only (FR-027)

### Implementation for User Story 6

- [x] T049 [P] [US6] Create `Timesheet` + `TimesheetEntry` models in `backend/apps/timesheets/models.py`: `week_start` Monday date, unique_together(employee, week_start), entry `date` must fall in week, `hours` Decimal(4,2) 0<h≤24, shared status/step/snapshot fields
- [x] T050 [US6] Implement timesheet endpoints in `backend/apps/timesheets/views.py`: `GET`/`POST /api/timesheets/`, detail, `submit/` (resubmit), `withdraw/`, `approve|reject|return/` via transition engine (FR-026)
- [x] T051 [US6] Create `frontend/src/features/timesheets/`: weekly grid (7 days × hours), submit, status/history display, returned-timesheet correction flow

**Checkpoint**: US6 functional — end-to-end weekly timesheet cycle

---

## Phase 9: User Story 7 - Notifications and Activity History (Priority: P2)

**Goal**: In-app notifications for actionable events + chronological item history.

**Independent Test**: Trigger transition → notification appears for recipient, unread→read,
links to item whose history shows the event (quickstart V3 step 6).

### Tests for User Story 7

- [x] T052 [P] [US7] Notification tests in `backend/tests/integration/test_notifications.py`: emitted on submit/decision/return to right recipient (FR-032), never for own action (FR-034), own-list only, mark read / read-all

### Implementation for User Story 7

- [x] T053 [US7] Implement notification endpoints in `backend/apps/notifications/views.py`: `GET /api/notifications/` (own, `unread=true` filter), `POST .../{id}/read/`, `POST .../read-all/`
- [x] T054 [US7] Implement history endpoints `GET /api/requests/{id}/history/` and `GET /api/timesheets/{id}/history/` (chronological AuditEntry, scoped to item viewers — FR-036)
- [x] T055 [US7] Create `frontend/src/features/notifications/`: bell w/ unread count (TanStack Query poll ~30s), list page, mark-read/read-all, deep-links; `components/history-timeline.tsx` embedded in request/timesheet detail

**Checkpoint**: US7 functional — notifications + history visible across items

---

## Phase 10: User Story 8 - HR Administration and Configuration (Priority: P3)

**Goal**: HR administers employees (create/reset/deactivate), request types (fields +
attachment rules), and workflow definitions.

**Independent Test**: HR creates type + 2-step workflow → employee submits → manager then
HR approvals → APPROVED; deactivated user can't sign in, records intact (quickstart V6).

### Tests for User Story 8

- [x] T056 [P] [US8] Admin tests in `backend/tests/integration/test_admin.py`: employee create returns one-time temp password + sets must_change_password, reset-password audited (FR-035), deactivate blocks login but retains records (FR-045), type/workflow CRUD, in-flight items keep workflow snapshot (FR-022), non-HR denied on all admin endpoints, HR detail access limited to items at an HR-assigned step (FR-019)

### Implementation for User Story 8

- [x] T057 [US8] Implement employee admin endpoints in `backend/apps/accounts/views.py`: `GET|POST /api/employees/`, `GET|PATCH /api/employees/{id}/`, `POST .../reset-password/` (one-time temp password response), `is_active` deactivation
- [x] T058 [US8] Implement request-type admin `POST|PATCH /api/request-types/` + workflow CRUD `GET|POST|PATCH /api/workflows/` (steps validation: ≥1 step, actor_role ∈ MANAGER|HR) in `backend/apps/requests/views.py` + `backend/apps/workflows/views.py`
- [x] T059 [US8] Create `frontend/src/features/admin/`: employee directory + create/edit/deactivate + reset-password (show temp once), request-type editor (fields-schema builder), workflow step editor

**Checkpoint**: US8 functional — configuration drives behavior without code changes

---

## Phase 11: User Story 9 - Dashboards, Search, and Filtering (Priority: P3)

**Goal**: Role-shaped dashboards + filtered, searched, paginated lists everywhere.

**Independent Test**: Mixed-status seed data → correct per-role dashboard counts →
filtered lists return exact subsets, scoped to caller (quickstart V7).

### Tests for User Story 9

- [x] T060 [P] [US9] Dashboard/filter tests in `backend/tests/integration/test_dashboard_filters.py`: role payload shapes, filter/status/date/submitter combos, inverted date range → 400 validation_error, search scoping (FR-039), pagination envelope on all lists (FR-044)

### Implementation for User Story 9

- [x] T061 [US9] Implement `GET /api/dashboard/` in `backend/apps/core/views.py`: role-shaped aggregates (employee: open requests + timesheet status + unread count; manager: + pending reviews + team counts; HR: + org volumes) via efficient aggregate queries
- [x] T062 [US9] Add django-filter FilterSets + `search`/`ordering` fields to list viewsets in `backend/apps/requests/views.py`, `apps/timesheets/views.py`, `apps/accounts/views.py`, `apps/notifications/views.py`; verify indexes from data-model.md exist; reject invalid ranges (e.g., date_to < date_from) with 400 validation_error
- [x] T063 [US9] Create `frontend/src/features/dashboard/`: three role dashboards w/ count cards linking to filtered lists; add filter bar + search input + pagination controls to all list pages

**Checkpoint**: US9 functional — dashboards + discovery at scale

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple stories

- [x] T064 Add login throttling (rate limit → 429) on `POST /api/auth/login/` per contracts/api.md in `backend/config/settings/base.py` + throttle class
- [x] T065 [P] N+1 audit: assert query counts in list tests; add `select_related`/`prefetch_related` + confirm indexes (data-model.md) via `django-debug-toolbar` or `assertNumQueries`
- [x] T066 [P] Accessibility pass per constitution VIII: labels on interactive elements, keyboard navigation on queues/forms, contrast check across `frontend/src/`
- [x] T067 [P] Frontend error boundary + safe error rendering (no internals surfaced — FR-041) in `frontend/src/components/`
- [x] T068 Extend `seed_demo` to cover all quickstart scenarios (mixed statuses, attachments, 10k-scale optional flag) in `backend/apps/core/management/commands/seed_demo.py`
- [x] T069 Run full quickstart.md validation V1–V7 and record results
- [x] T070 Write root `README.md`: stack, `docker compose` run steps, test commands (`pytest`, `vitest`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–11)**: Depend on Foundational; proceed P1 → P2 → P3 or in parallel where noted below
- **Polish (Phase 12)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — auth/session shell exists already; this phase adds role routing + `/api/me/`
- **US2 (P1)**: Foundational only — profile model built in T008; independent of US1's UI
- **US3 (P1)**: Foundational only — needs transition engine (T016) + workflow models (T015)
- **US4 (P2)**: Soft-depends on US3 (attaches to Request model/detail page); timesheet FK lands harmlessly early
- **US5 (P2)**: Soft-depends on US3 (reviews the requests it creates); independently testable with seeded items
- **US6 (P2)**: Foundational only — reuses T016 transition engine; parallel-safe with US3–US5 except shared `views.py` files noted
- **US7 (P2)**: Soft-depends on US3/US5/US6 events already emitting notifications (T014); independently testable via seeded events
- **US8 (P3)**: Foundational only — admin endpoints independent; validates configurability end-to-end
- **US9 (P3)**: Soft-depends on earlier lists existing; aggregation + filters are additive

### Within Each User Story

- Tests written first and MUST fail before implementation (constitution IX)
- Models → services → endpoints → frontend
- Story checkpoint passes before starting next priority

### Parallel Opportunities

- Phase 1: T002–T005, T007 all parallel after T001
- Phase 2: T011–T015, T019 parallel once models/conventions settle (T008–T010 sequence)
- After Foundational: US1/US2/US3 parallel; US6 parallel with US3–US5 (different app); US8 parallel with all
- Per story: test tasks [P] together; model tasks [P] together

## Parallel Example: User Story 3

```bash
# Tests first (parallel):
Task: "Request API tests in backend/tests/integration/test_requests.py"
Task: "Request permission tests in backend/tests/permissions/test_authz_matrix.py"

# Then models (parallel-safe with test writing):
Task: "RequestType + Request models in backend/apps/requests/models.py"
```

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1 + Phase 2 → foundation (auth, RBAC scaffold, audit, workflow engine, seed)
2. Phase 3 (US1) → role-aware sign-in works; demo-able skeleton
3. Then US2 + US3 complete the P1 core → true MVP (employees can request, profile works)

### Incremental Delivery

1. Setup + Foundational → runnable auth shell
2. +US1 → secure sign-in; +US2/+US3 → core employee flows (MVP)
3. +US4/+US5/+US6/+US7 → reviewable platform (P2)
4. +US8/+US9 → administrable, discoverable product (P3)
5. Polish → quickstart V1–V7 green

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] labels map to spec.md user stories for traceability
- `backend/apps/requests/views.py` is touched by US3, US5, US8 — sequence those within
  a story or merge carefully across parallel workers
- Commit after each task or logical group; no commits/pushes without user request
  (constitution workflow rule)

---

## Phase 13: Reports & Exports (merged from `specs/archive/002-reports`)

**Status**: PARTIAL — implementation verified live; test/verification tasks
below remain open. **ID mapping**: `RTnnn` below = original `Tnnn` in
`specs/archive/002-reports/tasks.md`. FR references map to the `R-FR-*` block in
`spec.md` § Reports & Exports. Legend: [EXISTS]/[VERIFY]/[FIX]/[NEW] as in the
original plan.

### Setup & foundational

- [x] RT001 Baseline existing `/api/reports/*` endpoints + scope + exports per role (EXISTS — verified live; regression anchor)
- [ ] RT002 [VERIFY] `backend/tests/integration/test_reports.py`: happy path per report, all filters server-side, `date_to<date_from` → 400, summary over full filtered set, pagination envelope (R-FR-002…011)
- [ ] RT003 [P] [VERIFY] `backend/tests/permissions/test_reports_scope.py`: per-role scope isolation + scope vocabulary + export id-parity + bad `fmt` → 400 (R-FR-012…015, R-FR-018)
- [ ] RT004 [FIX] `reports/views.py` `ReportExportView`: pass `employee_names`/`request_type_names` maps so export Filters line renders names not ids
- [x] RT005 [P] `reports.*` i18n keys in `en.json`/`ar.json` (titles, filters, actions, summary, states, unavailable)
- [x] RT006 [P] Report types in `frontend/src/types/index.ts` (ReportKey, ReportScope, row interfaces)
- [x] RT007 Wire `/reports` route + sidebar item + SECTION_TITLES

### On-screen scoped reports (R-US1)

- [x] RT008 Report config registry (columns/filters/summary descriptors) — landed in `features/reports/index.tsx` config table
- [x] RT009 `ReportsPage`: selector, draft→applied filters, Generate/Reset, scope-driven pickers, summary cards, paginated table, loading/empty/error states
- [ ] RT010 [P] `frontend/tests/reports.test.tsx`: selector render, type switching, scoped employee picker, rows, skeleton/empty states

### Filter validation & reset (R-US2)

- [ ] RT011 Client-side `date_to < date_from` guard + map backend `details` onto filter controls
- [ ] RT012 [P] Frontend tests: Generate applies draft, Reset clears, validation_error field mapping, no request on invalid input

### Export & print (R-US3)

- [x] RT013 `downloadFile` helper in `lib/api.ts` (Bearer + blob + Content-Disposition filename)
- [x] RT014 Excel/PDF export buttons (busy state, error surfacing)
- [ ] RT015 Print stylesheet (`@media print`, hide chrome, print header w/ title/filters/timestamp)
- [ ] RT016 [P] [VERIFY] Export-content assertions (content-type, `%PDF`, own-rows-only parse, over-cap 400)

### Localization / responsive / theme (R-US4)

- [x] RT017 All labels via `t()`, localized statuses, logical props for RTL, `lang` passed to exports
- [ ] RT018 [P] Frontend test: `ar` render — RTL + Arabic labels + dark theme smoke
- [ ] RT019 [P] Manual responsive check (quickstart V13): xs table scroll, filters stack

### Business rules verification (R-US5)

- [ ] RT020 [VERIFY] Tests: attendance day-grouping, Sun–Sat week display, `*_available:false` metrics, summaries over real fixtures
- [x] RT021 Timesheets `week` column renders Sun–Sat; hours 2-decimals; `null` metrics render "—" never `0`

### Polish & QC

- [ ] RT022 `assertNumQueries` for reports (no per-row N+1)
- [ ] RT023 Full verification pass: backend pytest + frontend test + ruff + tsc green
- [ ] RT024 Browser-verify reports quickstart V1–V16 across all three roles
- [ ] RT025 README/ai_docs updates if warranted

**Dependencies**: RT002/RT003 (scope proof) gate everything else;
RT010/RT012/RT018 share `tests/reports.test.tsx` (create once in RT010);
RT023–RT025 last.

---

## Phase 14: Application Shell & Presentation (merged from `specs/archive/003-ui-ux-shell`)

**Status**: COMPLETED. **ID mapping**: `Unnn` preserved from the retired spec.

- [x] U001 MUI theme provider, light/dark palettes, `cds-theme` persistence
- [x] U002 i18next + `en.json`/`ar.json` catalogs + `cds-language` + RTL driver
- [x] U003 Shared UI primitives (`components/ui.tsx`: PageCard, EmptyState, TableSkeleton, ErrorAlert, StatusBadge, PaginationControls)
- [x] U004 Sidebar nav (role-filtered) + active highlight
- [x] U005 Top header (section titles, global search, theme/language switchers, chat/notification bells, user menu, Check In)
- [x] U006 Responsive collapse + RTL mirroring
- [x] U007 Dashboard redesign (role KPIs, charts, recent activity)
- [x] U008 Attendance page · [x] U009 Timesheets · [x] U010 Requests · [x] U011 Reports · [x] U012 Profile/Settings/Admin
- [x] U013 `tests/i18n-theme.test.tsx` EN/AR/RTL + theme switching
- [x] U014 Dark-mode + RTL live browser verification
