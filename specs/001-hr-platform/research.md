# Phase 0 Research: CDS Business HR Platform

All Technical Context fields were resolved from the ratified constitution stack — no
NEEDS CLARIFICATION placeholders remained. This document records the design-level
decisions needed to implement the spec within that stack.

## R1 — Server-side RBAC enforcement pattern

- **Decision**: Two-layer enforcement in DRF: (1) `permission_classes` combining
  `IsAuthenticated` + a role check (`IsEmployee`/`IsManager`/`IsHR`) + object-level
  `has_object_permission`; (2) queryset scoping in `get_queryset()` so list/detail never
  return objects outside the caller's scope (self, direct reports, org-level for HR).
- **Rationale**: Queryset scoping makes "search can never surface out-of-scope items"
  (FR-038) structural rather than per-endpoint; object permissions catch direct-ID access.
  Both layers are required — either alone leaks.
- **Alternatives considered**: Row-level security in Postgres (over-engineered for one
  monolith, complicates migrations); django-rules/guardian (per-object ACL tables
  unnecessary — access derives from role + manager FK, not arbitrary grants).

## R2 — JWT token handling

- **Decision**: SimpleJWT `Bearer` access tokens (15 min) + rotating refresh tokens
  (1 day). Access token kept in memory in the SPA; refresh token in an `HttpOnly`,
  `Secure`, `SameSite=Lax` cookie. On login the SPA stores nothing persistent for access.
- **Rationale**: Short-lived access + httpOnly refresh minimizes XSS token theft
  (constitution II). In-memory access token survives no reloads — a silent refresh call
  restores the session.
- **Alternatives considered**: Both tokens in localStorage (XSS-exposed — rejected);
  both in cookies (needs CSRF machinery for every mutation — heavier for MVP).

## R3 — Workflow engine

- **Decision**: Data-driven lightweight workflow: `Workflow` → ordered `WorkflowStep`s
  (each naming the acting role: MANAGER or HR). A `transition` service validates
  (a) item status, (b) caller's role vs current step, (c) manager-relationship when the
  step role is MANAGER — then applies the action (`approve`/`reject`/`return`/`withdraw`)
  inside `transaction.atomic()` and writes the `AuditEntry` + `Notification` in the same
  transaction.
- **Rationale**: HR must configure workflows without code changes (FR-022); a steps table
  is the simplest model that expresses "who acts at each step" and ordering, and keeps the
  transition rules in one place (constitution IV).
- **Alternatives considered**: django-fsm / viewflow (model-code-bound states — conflicts
  with HR-configurable workflows); hardcoded status machine per item type (duplicated
  logic, not configurable).

## R4 — Audit trail

- **Decision**: Single append-only `AuditEntry` table (actor, action, item type+id,
  from/to status, comment, timestamp, request-id). Written explicitly by service-layer
  functions inside the same transaction as the mutation — not via Django signals.
- **Rationale**: Explicit service calls keep audit coupled to business actions (not raw
  row saves) and testable; same-transaction writes make audit impossible to lose
  (constitution III/IV).
- **Alternatives considered**: django-simple-history (row snapshots — heavier; audit is
  action-level, not field-diff level); signals (spooky action — audit misses context like
  review comments).

## R5 — Secure attachments

- **Decision**: `FileField` under `MEDIA_ROOT` at repo root, `MEDIA_URL` unset/not routed.
  Download endpoint `GET /api/attachments/{id}/` runs the same object-permission check as
  the parent item, then streams the file (`FileResponse`) with original filename.
  Upload validation: allowlist of MIME types (pdf, png, jpg, docx, xlsx, txt), 10 MB max.
- **Rationale**: Streaming through DRF is the simplest design that guarantees
  authorization on every download (constitution V); no public URL exists at all.
- **Alternatives considered**: Nginx `X-Accel-Redirect` (faster for large files — noted as
  a later optimization; adds internal-location config now); presigned/object storage
  (violates "private local filesystem for MVP" stack decision).

## R6 — Notifications

- **Decision**: DB-backed `Notification` rows (recipient, item ref, message, read_at,
  created_at). Frontend polls the notification list via TanStack Query (staleTime ~30s,
  refetch on focus). Emitted by the transition/submission services in-transaction.
- **Rationale**: In-app only per spec assumptions; polling meets SC-005 (≤30s) with zero
  infrastructure beyond Postgres.
- **Alternatives considered**: WebSockets/channels (real-time — unnecessary complexity for
  a 30s requirement); Django signals to create notifications (same R4 argument).

## R7 — Password lifecycle (HR-mediated)

- **Decision**: `User.must_change_password` flag. HR create/reset generates a random
  temporary password, returns it once to the HR user, and sets the flag; a `change-password`
  endpoint clears it. All routes except login + change-password reject requests while the
  flag is set.
- **Rationale**: Implements the clarified Q4 decision without an email dependency; the
  flag gate is one middleware/permission check.
- **Alternatives considered**: Django password-reset token + email (needs email backend —
  out of scope per clarification); admin-only resets via Django admin (not in the SPA's
  RBAC model).

## R8 — Frontend architecture

- **Decision**: Feature-sliced SPA: `features/{requests,timesheets,notifications,admin,
  dashboard}/` each owning its components, hooks, and zod schemas. One typed API client in
  `lib/` (fetch wrapper injecting Bearer token, handling 401→refresh→retry). Route guards
  check role for navigation; menus hide disallowed routes — display-only, never security.
- **Rationale**: Matches modular boundaries constitution IX; TanStack Query gives
  pagination/invalidation for free after mutations (approve → invalidate queues).
- **Alternatives considered**: Page-based structure (scatters a feature across dirs —
  harder to review); Redux (TanStack Query covers server state; UI state is local).

## R9 — Pagination, filtering, search

- **Decision**: `PageNumberPagination` (page size 25) as the DRF default — every list is
  paginated (FR-043). `django-filter` for declared filter fields (status, type, date
  range); simple `icontains` search on designated fields. DB indexes on every filtered/
  ordered FK and status column.
- **Rationale**: Defaults enforce constitution VI globally; declared filters prevent
  arbitrary-field querying.
- **Alternatives considered**: Cursor pagination (better for huge tables — unnecessary at
  10k scale); full-text search (premature — keyword icontains suffices for MVP scope).

## R10 — Testing strategy

- **Decision**: Backend: pytest + pytest-django + factory_boy; API-level tests asserting
  status codes and RBAC denials per role; a dedicated `tests/permissions/` matrix covering
  every endpoint × role. Frontend: Vitest + Testing Library for critical flows (login
  gate, request form validation, review actions). Constitution-mandated trio per feature:
  happy path, edge case, permission.
- **Rationale**: Permission-matrix tests directly verify SC-001 (100% denial outside
  scope); API-level tests catch queryset-scoping leaks.
- **Alternatives considered**: Django's unittest (pytest fixtures scale better);
  Playwright E2E (valuable later — heavy to bootstrap; quickstart covers manual E2E).

## R11 — Deployment topology

- **Decision**: Compose services: `db` (postgres:16), `backend` (gunicorn), `frontend`
  (build → static assets served by Nginx), `nginx` (proxy `/api/` → backend, `/` → SPA).
  Named volume for Postgres; bind-mounted `media/` volume shared only with backend.
- **Rationale**: Matches the ratified stack exactly; media is reachable only through the
  backend service — the auth check is unavoidable.
- **Alternatives considered**: Nginx serving media directly (bypasses authorization —
  rejected, constitution V).

## Unresolved / Deferred

- File download optimization via `X-Accel-Redirect` (deferred — current streaming meets
  requirements; revisit if large-file profiling demands it).
- E2E browser testing (deferred — quickstart provides scripted manual validation).
- Email channel for notifications and password reset (explicitly out of scope per spec
  assumptions and clarification Q4).

---

# Appendix: Reports decisions (merged from `specs/archive/002-reports/research.md`)

Gap analysis (2026-10-06): `apps/reports/` was already partially built when
specced — treated as candidate implementation verified by tests, not rewritten.

Decisions (all still in force):
1. **Config-driven single Reports page** — one component + per-report config
   table (mirrors backend `exports.COLUMNS`), not four divergent pages.
2. **Blob download for exports** — Bearer auth requires `fetch`+`blob()` +
   `createObjectURL` anchor; `<a href>` can't send the header.
3. **Print = browser print** of the current view via `@media print` (separate
   server print doc rejected — duplicates PDF).
4. **Filter vocabulary from `/api/reports/scope/`** — UI can only offer
   choices the backend accepts.
5. **UI stack = MUI + existing primitives** (codebase standardized on MUI over
   the constitution's Tailwind/shadcn mention; consistency won).
6. **Mobile reports = horizontal-scroll tables** (dense numeric grids).
7. **Draft-vs-applied filter state** — Generate applies into the query key;
   no query-per-keystroke.
8. **`lang=<i18n.language>` passed to exports** so files match UI language.

Known gap found at spec time (still open): `ReportExportView` never passed
`employee_names`/`request_type_names` → export Filters line shows raw ids
(task RT004).
