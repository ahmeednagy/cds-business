# Implementation Plan: HR Reports

**Branch**: `002-reports` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-reports/spec.md`

## Summary

Deliver the Reports module: four scoped, filterable reports (Attendance,
Timesheets, Requests, Employee Summary) with XLSX/PDF export, browser print,
EN/AR + RTL, CDS red/gray design, responsive layout, and full UI states —
backed by server-side filtering/aggregation on the platform's existing
least-privilege scopes. The `apps/reports/` backend already exists from an
interrupted session and is **reused as-is** where it satisfies the spec
(gap-analyzed in [research.md](research.md)); the remaining work is the entire
frontend Reports UI, print support, a small export-label polish, and backend +
frontend test coverage.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x (frontend)

**Primary Dependencies**: Django + DRF, djangorestframework-simplejwt,
django-filter, openpyxl, reportlab, arabic-reshaper, python-bidi; React 18,
Vite, **MUI** (existing codebase UI system), TanStack Query, react-i18next,
react-router-dom

**Storage**: PostgreSQL 16 (reports are read-only views — no new tables)

**Testing**: pytest + pytest-django + factory_boy (`backend/tests/`); Vitest +
Testing Library (`frontend/tests/`)

**Target Platform**: Docker Compose dev stack — Vite dev server :5173 proxying
`/api` → Django runserver :8000

**Project Type**: Web application — backend REST API + frontend SPA

**Performance Goals**: Reports respond <2s on demo data; constant query counts
in builders (no per-row queries); exports capped at 50k (xlsx) / 2k (pdf) rows

**Constraints**: Server-side RBAC is authoritative — every report reuses
`scope_items`/`scope_attendance`/`visible_employees`; exports share the same
scope; no fabricated metrics; errors via the `{error:{code,message,details}}`
envelope; print + exports respect filters

**Scale/Scope**: 4 report types, ~1 new frontend route/page, 1 sidebar entry,
~1 new test file per side

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Evidence |
|-----------|---------|----------|
| I. Role model | PASS | Reports map to the existing EMPLOYEE/MANAGER/HR scopes — no new tiers |
| II. Server-side RBAC (NON-NEGOTIABLE) | PASS | Builders derive rows via `scope_items`/`scope_attendance`; exports reuse identical scope; out-of-scope employee filter → 400 |
| III. Audit trail | PASS | Reports are read-only; no mutations to audit |
| IV. Data integrity | PASS | No writes; week/status invariants read from stored data |
| V. Secure file handling | PASS | Exports stream via authenticated API with `Content-Disposition: attachment`; no public URLs |
| VI. Performance | PASS | Paginated reports; aggregate queries; export caps; N+1 audited (constant-count assertions planned) |
| VII. Secure errors | PASS | Uniform error envelope; export cap → `validation_error`, not a stack |
| VIII. Accessibility | PASS | Reuses labeled MUI controls/states; print uses semantic table |
| IX. Maintainability/testability | PASS | Plan mandates backend + frontend coverage before completion |
| Approved stack | DEVIATION (documented) | Constitution lists Tailwind + shadcn/ui; the shipped codebase standardized on MUI — Reports follows the codebase convention (see Complexity Tracking) |

## Project Structure

### Documentation (this feature)

```text
specs/002-reports/
├── plan.md              # This file
├── research.md          # Phase 0: gap analysis + decisions
├── data-model.md        # Phase 1: logical report shapes
├── contracts/api.md     # Phase 1: endpoint contract
├── quickstart.md        # Phase 1: validation scenarios V1–V16
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── apps/reports/            # EXISTS — reused
│   ├── services.py          # 4 scoped builders + REPORTS registry + scope_payload
│   ├── filters.py           # server-side filter parsing/validation
│   ├── views.py             # report JSON + export views
│   ├── urls.py              # wired in config/urls.py
│   ├── exports.py           # xlsx/pdf builders, fonts, size caps
│   └── fonts/               # DejaVu + Noto Sans Arabic TTFs
└── tests/
    ├── integration/test_reports.py     # NEW — endpoints, filters, exports
    └── permissions/test_reports_scope.py  # NEW — per-role data isolation

frontend/
├── src/
│   ├── features/reports/    # NEW — page + report config + export/print
│   ├── i18n/en.json|ar.json # + reports.* keys
│   ├── types/index.ts       # + report types
│   ├── components/Layout.tsx# + sidebar item + title mapping
│   ├── routes/index.tsx     # + /reports route
│   └── index.css            # + @media print rules
└── tests/reports.test.tsx   # NEW
```

**Structure Decision**: Web-application layout (Option 2) matching the repo.
Backend app already exists and stays put; frontend follows the existing
`src/features/<feature>/` convention.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| MUI instead of constitution's Tailwind+shadcn | The entire shipped frontend (theme, RTL cache, `components/ui` primitives, every feature page) is MUI; a one-off Tailwind page would break visual consistency, double the UI stack, and bypass existing primitives | Adopting Tailwind for this feature only — inconsistent UI, duplicated primitives, constitution already diverged for the whole app |

## Gap classification (drives tasks.md)

| Area | Status |
|------|--------|
| Report builders + scoping (`services.py`) | EXISTS → verify by tests (FR-002…007, FR-012) |
| Filter parsing/validation (`filters.py`) | EXISTS → verify by tests (FR-008…010) |
| Scope vocabulary endpoint (`scope_payload`) | EXISTS → verify by tests (FR-014) |
| JSON report endpoints + pagination + summary/meta | EXISTS → verify by tests |
| XLSX/PDF export engine + Arabic shaping + fonts + caps | EXISTS → verify by tests; FIX export Filters line to render names not ids |
| URL wiring | EXISTS — done |
| Backend tests | MISSING — implement |
| Frontend Reports UI (route, nav, page, filters, states, i18n) | MISSING — implement |
| Print | MISSING — implement (browser print, print stylesheet) |
| Frontend tests | MISSING — implement |
