## MODULE: requests_page (frontend + apps/requests)
## VERSION: 1.0
## LAST_UPDATED: 2026-10-12

### MODELS
- Request | requests.models | request_type FK, submitter FK, values JSON, status(PENDING/IN_REVIEW/RETURNED/APPROVED/REJECTED/WITHDRAWN), current_step, workflow_snapshot JSON, current_actor_role, submitted_at | default ordering -submitted_at
- RequestType | requests.models | name unique, workflow FK, fields_schema JSON, allow_attachments, require_attachments, is_active

### API
- GET /api/requests/ | filters: status, request_type, submitter, date_from, date_to (submitted_at date), pending_review, search | ordering: submitted_at, status, request_type__name, submitter__email, current_actor_role
- search → Q(request_type__name | submitter__email | submitter__profile__first_name | submitter__profile__last_name | current_actor_role) icontains — scoped queryset only
- GET /api/request-types/ | non-HR sees is_active only
- GET /api/reports/scope/ | employees[{id,name,email}] within caller's authorized scope — drives submitter display names
- Detail POST actions: submit (owner, RETURNED), withdraw (owner, PENDING pre-review), approve/reject/return (current actor) — gated by wf.available_actions
- date_to < date_from → 400 validation_error (RequestFilter.is_valid)

### VIEWS (frontend)
- frontend/src/features/requests/list.tsx | redesigned: custom header, filter card, 4 stat cards, sortable table, actions menu, pagination outside card
- Deep links: ?status= and ?search= seed draft+applied filters
- Draft/applied filter pattern: Apply commits, Clear resets
- Actions menu items navigate to /requests/:id (server `actions` gates real ops)

### KNOWN_CONSTRAINTS
- Pending card = PENDING + IN_REVIEW counts; Rejected card = REJECTED only
- Request-type tile icon is name-heuristic (leave/loan/travel/document), decorative
- No request-type category/description field → no secondary line under type name
- No bulk actions → no selection checkbox column
- Submitter name falls back to email when outside report-scope name map

### CHANGE_LOG
- 2026-10-12 | redesigned list page: Search|Status|Type|Range|Clear|Apply filter card, 4 stat cards w/ decorative bars, sortable table (5 cols), actions menu, external pagination; backend: filter_search widened to submitter/reviewer fields, ordering_fields +3
