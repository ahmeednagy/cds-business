# Tasks: UI/UX Application Shell & Redesign

**Status**: COMPLETED — retroactive task list; all items verified implemented.

## Phase 1: Foundations

- [x] U001 MUI theme provider with light/dark palettes (CDS red/gray),
  `cds-theme` persistence (`src/theme/index.tsx`)
- [x] U002 i18next setup + `en.json`/`ar.json` full string catalogs +
  `cds-language` persistence + `isRtlLanguage` (`src/i18n/`)
- [x] U003 Shared UI primitives in `components/ui.tsx` (PageCard, EmptyState,
  TableSkeleton, ErrorAlert, StatusBadge, PaginationControls)

## Phase 2: Application Shell

- [x] U004 Layout: sidebar nav (Dashboard/Attendance/Timesheets/Requests/
  Reports/Settings), role-filtered, active highlight (`Layout.tsx`)
- [x] U005 Top header: section title map, global search, theme toggle,
  language switcher, chat bell, notification bell, user menu, Check In control
- [x] U006 Responsive collapse + RTL mirroring of the shell

## Phase 3: Page Redesigns

- [x] U007 Dashboard redesign: role-aware KPI cards, charts, recent activity
- [x] U008 Attendance page (check-in/out UI, sessions, break-time metrics)
- [x] U009 Timesheets page (weekly grid, statuses)
- [x] U010 Requests pages (list, create, detail, review actions)
- [x] U011 Reports page (selector, filters, summary cards, table, exports)
- [x] U012 Profile/Settings pages + admin pages

## Phase 4: Verification

- [x] U013 `tests/i18n-theme.test.tsx` — EN/AR/RTL + theme switching test
- [x] U014 Dark-mode + RTL live verification (browser screenshots)

## Notes

- No open tasks. Presentation bugs found later are logged against the owning
  feature's spec (e.g., chat RTL → 005).
