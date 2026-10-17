# Requests Page — Developer SOP

## Purpose
Requests list page (`/requests`) redesigned to match the CDS Business reference
visual language: page header, professional filter card, four summary cards,
polished sortable table, and pagination rendered outside the table card.
All data and workflow rules are unchanged and real.

## Backend changes (apps/requests)
- `filters.py` — `filter_search` now matches request type name, submitter
  email, submitter profile first/last name, and `current_actor_role`
  (icontains, OR-ed). Runs on the role-scoped queryset; no visibility change.
  Inverted `date_from`/`date_to` still raises 400 via
  `_DateRangeValidationMixin` — dates are never silently swapped.
- `views.py` — `ordering_fields` extended to `submitted_at`, `status`,
  `request_type__name`, `submitter__email`, `current_actor_role` so every
  table header sort indicator is backed by the API.

## Frontend structure (frontend/src/features/requests/list.tsx)
- Header: custom block (1.75rem/800 title + subtitle + 52px red
  "New request" → /requests/new). Shared `PageHeader` intentionally unused.
- Filter card grid: `xs:1fr, sm:2col, lg: 25fr 18fr 18fr 18fr auto auto`.
  Fields are 50px/10px-radius; Clear (outlined) + Apply (red, funnel icon)
  align with inputs. Reviewers also get "Awaiting my review" inside the card.
- Filters are draft state; Apply commits, Clear resets. `?status=`/`?search=`
  deep links seed both.
- Date range: preset select (All time / This week / Last week / Last 4 weeks /
  This month / Last month) → `date_from`/`date_to` on `submitted_at`. Week
  presets use the project's Sun–Sat business week via `businessWeek()`.
- Summary cards: pale red/green/amber/blue, decorative mini-bars
  (aria-hidden, low opacity — no data implied). Counts come from
  `page_size=1` queries sharing all applied filters except status.
  Pending = PENDING + IN_REVIEW; Rejected = REJECTED. Percentages guard
  total=0.
- Table: REQUEST TYPE (red 40px tile + name-heuristic icon + bold name),
  SUBMITTER (avatar + name from `/api/reports/scope/` map + email fallback),
  STATUS (shared StatusBadge), SUBMITTED (date + muted time), CURRENT
  REVIEWER (localized role or —), ACTIONS (bordered ⋯).
- Actions menu: View always; Review when `current_actor_role === user.role`
  and status is PENDING/IN_REVIEW; Withdraw for owner+PENDING; Resubmit for
  owner+RETURNED. All navigate to the detail page where server `actions`
  enforce real permissions.
- Pagination: sibling row below the card (mt≈18px), count text left, circular
  numbered controls + chevrons right, current page CDS red, mirrored in RTL.

## Test scenarios
- Happy: list renders rows; Apply/Clear re-queries; sortable headers cycle
  asc→desc→clear; pagination real.
- Edge: empty → EmptyState (+New or Clear filters); total=0 → 0% captions;
  unknown type name → generic tile icon.
- Permission: employee sees own rows only; reviewer menu entries only when
  `current_actor_role` matches; HR scope unchanged.

## Known limitations
- No request-type "category" exists in the API → no secondary line under the
  type name (the reference's "Vacation" is not reproduced).
- No bulk actions → reference's selection checkbox column omitted.
- Search covers type/submitter/reviewer-role, not arbitrary request values.
