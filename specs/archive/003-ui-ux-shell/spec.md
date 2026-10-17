# Feature Specification: UI/UX Application Shell & Redesign

**Feature Branch**: `003-ui-ux-shell`

**Created**: 2026-10-06 (retroactive spec — documented 2026-10-16 from implementation)

**Status**: COMPLETED — all described behavior verified live in the running app
(screenshots verified in light/dark + EN/AR).

**Input**: Application shell redesign covering layout, navigation, theming,
localization, and responsive behavior across all feature pages.

## Scope

Global presentation layer for CDS Business — applies to every page. Feature
pages implement these rules; they do not redefine them.

## User Stories

### US1 - Application Shell (P1)

A persistent layout with a left sidebar (right in RTL) listing Dashboard,
Attendance, Timesheets, Requests, Reports, Settings; a top header with global
search, theme toggle, language switcher, chat bell, notification bell, user
menu, and a contextual section title. The sidebar collapses on small screens.

**Acceptance**:

1. Every authenticated route renders inside the shell; the active nav item is
   highlighted.
2. The header section title reflects the current route.
3. On mobile widths the sidebar collapses and content remains usable.

### US2 - Themes (P1)

Light and dark themes persisted via `localStorage` (`cds-theme`), applied
through the MUI theme provider; all components render legibly in both.

**Acceptance**:

1. Toggling the theme flips the whole app instantly and persists on reload.
2. Status colors, tables, chat bubbles, and call events keep sufficient
   contrast in dark mode.

### US3 - Localization EN/AR + RTL (P1)

Full i18n via i18next; language persisted in `localStorage` (`cds-language`).
Arabic switches `dir` to RTL — layout, icons, paddings, and text alignment flip
correctly everywhere.

**Acceptance**:

1. Switching to Arabic renders all strings in Arabic and mirrors the layout.
2. Direction-aware icons (chevrons, arrows) flip in RTL.
3. Dates/times use the active locale; backend payloads keep internal values
   (e.g., status codes) — only display labels localize.

### US4 - Redesigned Feature Pages (P2)

Dashboard (role-aware KPIs, charts, recent activity), Attendance page,
Timesheets grid, Requests list/detail, Reports page, Profile/Settings — all
rebuilt in the CDS red/gray design language.

**Acceptance**:

1. Each page renders its redesigned layout in both themes/languages.
2. Loading, empty, and error states exist on every data-driven page.

## Functional Requirements

- **FR-001**: A single application shell wraps all authenticated routes.
- **FR-002**: Light/dark theme toggle persists and applies globally.
- **FR-003**: Every user-facing string goes through `t()`; no hardcoded English
  (or Arabic) literals in components.
- **FR-004**: RTL is driven by language, not by a separate toggle.
- **FR-005**: Responsive breakpoints keep every page usable on desktop/tablet/
  mobile.
- **FR-006**: Statuses render via shared localized badges; API payloads never
  localize internal values.
- **FR-007**: Global search in the header searches permitted-scope items only
  (delegates to existing scoped endpoints).

## Key Files

- `frontend/src/components/Layout.tsx`, `components/switchers.tsx`,
  `components/GlobalSearch.tsx`
- `frontend/src/theme/index.tsx`, `frontend/src/i18n/{index,en.json,ar.json}`
- `frontend/src/features/*` (all feature pages)

## Success Criteria

- All pages render identically-shaped in EN and AR; no mixed-direction layout
  bugs.
- Theme and language survive reload.
- `i18n-theme.test.tsx` passes.
