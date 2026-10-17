## MODULE: timesheets page (frontend feature: src/features/timesheets)
## VERSION: 1.0
## LAST_UPDATED: 2026-10-12

### MODELS
- Timesheet | backend apps.timesheets | key fields: week_start:DateField(Monday key):required, status:choice, submitter:FK, submitted_at:auto_now_add, total_hours:computed(entries sum) | unique(submitter, week_start)

### METHODS
- resolveRange(preset) → {from,to,sunday,saturday} | filter draft | maps presets to week_from/week_to Monday keys
- toggleSort(field) → ordering param | TableSortLabel click | refetches list
- applyFilters()/clearFilters() → commits draft→applied / resets | buttons | page reset to 1
- businessWeek(week_start) → {sunday,saturday} | display | Sun–Sat span for a Monday key

### VIEWS
- TimesheetListPage | page | /timesheets | header+filter panel+4 stat cards+table+pagination
- StatCard | component(local) | summary | icon badge + value + tinted label + caption
- FilterField | component(local) | filter panel | label above control
- detail.tsx | unchanged | row click / menu → /timesheets/:id
- new.tsx | unchanged | + New timesheet → /timesheets/new

### SECURITY
- EMPLOYEE → own timesheets only; employee filter hidden (scope.can_pick_employee=false)
- MANAGER → self + direct reports | HR → org-wide
- Row actions = navigation only; real action gating via detail page `actions`

### DEPENDENCIES
- GET /api/timesheets/ → list; params: status, submitter, week_from, week_to, pending_review, ordering(week_start|status|submitted_at), page, page_size
- GET /api/reports/scope/ → employee dropdown + submitter→name lookup (scoped)

### EXTERNAL_LINKS
- timesheet.submitter ↔ reports/scope employees[].id via employeeName map
- AttendanceControl invalidates ["timesheet","timesheets"] query keys on check-in/out

### KNOWN_CONSTRAINTS
- week_start is a Monday key; business week displayed as Sun–Sat via businessWeek()
- Summary cards apply all filters EXCEPT status (status breakdown)
- EMPLOYEE/HOURS columns not sortable (API ordering_fields lacks them)
- Count queries use page_size=1 — cheap cardinality reads

### CHANGE_LOG
- 2026-10-12 | redesigned list page: filter panel, 4 stat cards, sortable table, actions menu, custom pagination; added submitted_at ordering field
- 2026-10-12 | header moved off PageHeader to custom (1.75rem/800 title, 52px New button); filter grid = 20fr/27fr/27fr/auto/auto with spacer when Employee hidden; card py tightened
- 2026-10-12 | Pagination moved outside the table Card — card ends after last row; standalone row below (mt≈18px), count left / controls right, RTL-mirrored; no logic change
