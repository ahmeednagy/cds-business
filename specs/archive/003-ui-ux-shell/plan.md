# Implementation Plan: UI/UX Application Shell & Redesign

**Status**: COMPLETED (retroactive documentation)

## Architecture

- **Theme**: single MUI `ThemeProvider` in `src/theme/index.tsx`; palette built
  per mode (light/dark) around CDS red (`#C8102E`-family) + neutral grays.
  Persisted in `localStorage` key `cds-theme`.
- **i18n**: i18next + `i18next-browser-languagedetector`; resources loaded from
  `src/i18n/{en,ar}.json`; persisted in `cds-language`. `isRtlLanguage()` drives
  `document.dir` and theme direction (`theme.direction = "rtl"`).
- **Shell**: `components/Layout.tsx` renders AppBar + permanent/collapsible
  Drawer nav (role-filtered items) + `<Outlet/>`. Section titles map
  `SECTION_TITLES` route → `nav.*` key.
- **RTL**: logical CSS props (`ms`/`me`/`marginInlineStart`), direction-aware
  icon selection (`isRtl ? ChevronLeft : ChevronRight`).
- **Pages**: redesigned feature pages under `src/features/` consume shared
  primitives in `components/ui.tsx` (PageCard, EmptyState, TableSkeleton,
  ErrorAlert, StatusBadge, PaginationControls).
- **Global search**: `components/GlobalSearch.tsx` → scoped `/api/search/`-style
  endpoints (respects caller scope).

## Constraints inherited

- Server remains the security boundary — nav hiding is display-only.
- Internal status values never localize in payloads (display mapping only).
