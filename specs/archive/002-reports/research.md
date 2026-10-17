# Research: HR Reports

**Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

## Gap analysis vs. existing implementation

An interrupted earlier session already produced `backend/apps/reports/` —
`services.py` (4 report builders on the existing `scope_items`/`scope_attendance`
RBAC helpers), `filters.py` (server-side filter parsing/validation),
`views.py` + `urls.py` (JSON + export endpoints, wired in `config/urls.py`),
`exports.py` (XLSX/PDF + Arabic shaping + bundled fonts). Live-verified in the
Docker stack: all four reports, scope endpoint, xlsx/pdf exports, and validation
errors behave per spec for all three roles.

**Decision**: treat the existing backend as the baseline implementation to be
*verified by the new test suite* (spec is the contract, code is candidate), not
rewritten and not paralleled.

**Known backend gaps found during inspection** (to be fixed during implementation):

- `_filters_text` in exports accepts `employee_names`/`request_type_names`
  lookup maps, but `views.py` never passes them → exports render raw ids in the
  Filters line instead of names. Fix: build the maps in `ReportExportView`.
- No automated tests for any report builder, endpoint, scope, or export.
- Everything else verified correct: Sun→Sat week math (`business_week_start =
  week_start − 1d`, `week_end = week_start + 5d`), status grouping without
  mutating per-row status, honest `*_available: false` metrics, export size
  caps, `finalize()` bulk lookups (no per-row queries — `wf.current_step` is
  pure Python on `workflow_snapshot`).

## Decisions

### Decision 1 — Reports page architecture

**Decision**: A single `frontend/src/features/reports/` module with one page
component driven by a per-report config table (columns, available filters,
summary metric descriptors), mirroring how `exports.COLUMNS` keys the four
reports on the backend.

**Rationale**: Four near-identical CRUD-free screens; a config-driven page
avoids four divergent implementations and keeps EN/AR labels in one map.

**Alternatives considered**: four separate page components — rejected: 4×
duplicated filter/export/state logic for zero benefit.

### Decision 2 — Export download mechanism

**Decision**: Export via `fetch` against `/api/reports/<key>/export/?fmt=…`
through the existing `api.ts` credentials path, read as `blob()`, then trigger
download via `URL.createObjectURL` + temporary anchor. Busy state on the button
while in flight.

**Rationale**: The backend authorizes via `Authorization: Bearer` header — a
plain `<a href>` cannot send it. Blob download preserves auth, error envelopes
(JSON blob → parse → ApiError), and lets us disable the control in flight.

**Alternatives considered**: `window.open(url)` — rejected (no auth header);
backend switch to cookie auth for exports — rejected (weakens token model).

### Decision 3 — Print

**Decision**: Browser print of the current report view — a print stylesheet
(`@media print` + `Print`/`displayPrint` MUI display props) that hides sidebar,
header, and filter/export controls, expands the current page's table, and adds
the report title + applied filters + generated timestamp header.

**Rationale**: Spec assumption (confirmed reasonable): print is a rendering of
what's on screen; a separate server-side print document would duplicate PDF.

**Alternatives considered**: reusing the PDF path for print — rejected (extra
round trip, surprises users who expect `Ctrl+P` of the current view).

### Decision 4 — Filter/scope vocabulary source

**Decision**: Use the existing `GET /api/reports/scope/` payload to populate the
Employee, Department, and Request Type dropdowns (`can_pick_employee` controls
whether the employee select renders for the caller's role).

**Rationale**: The endpoint already returns scope-filtered vocabulary; the UI
can never offer a choice the backend would reject.

### Decision 5 — UI stack & theming

**Decision**: MUI components + `sx` responsive props + existing `components/ui`
primitives (`PageHeader`, `FilterBar`, `SectionCard`, `TableSkeleton`,
`EmptyState`, `ErrorAlert`, `PaginationControls`, `StatusBadge`), i18next keys
in `en.json`/`ar.json`, RTL via the existing `stylis-plugin-rtl` Emotion cache —
same stack as every existing feature page.

**Rationale**: The constitution nominally lists Tailwind + shadcn/ui, but the
shipped codebase standardized on MUI (see Complexity Tracking in plan.md).
Consistency with existing pages beats introducing a second UI system.

### Decision 6 — Report tables on mobile

**Decision**: Horizontal-scroll `TableContainer` with a sensible `minWidth` on
small viewports (rather than the card-per-row pattern used by list pages).

**Rationale**: Report tables have 6–10 columns of dense numeric data; card rows
would obscure the tabular nature. Scrollable tables are the standard responsive
answer for data grids.

### Decision 7 — Query/state model

**Decision**: Draft filter state vs. applied filter state: filter inputs edit a
draft; clicking **Generate** applies them into the TanStack Query key
(`["report", key, applied, page]`). Reset clears both. Filters hidden/disabled
appropriately per report type come from the report config.

**Rationale**: Reports should re-run on explicit user action (Generate), not on
every keystroke — matches "generate report" mental model and avoids a query per
keystroke on dates.

### Decision 8 — `lang` for exports

**Decision**: The frontend passes `lang=<current i18n language>` on export
requests so exported documents match the UI language (server already supports
`lang` in `parse_filters`).

## Resolved NEEDS CLARIFICATION

None — no unknowns remain. The spec's assumptions (all roles see Reports; print
= browser print; filters optional; export caps) are adopted as decisions.
