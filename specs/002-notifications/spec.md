# Feature Specification: Notifications

**Feature Branch**: `002-notifications`

**Created**: 2026-10-16 (retroactive spec — UX delivered incrementally with
001 + later features; documented from implementation)

**Status**: COMPLETED for described behavior. Delivery is poll-based (60 s),
not push-realtime — see FR-009 note.

## Scope

The in-app notification experience: bell + dropdown in the header, the
`/notifications` page, unread counting, deep-linking, and event sources
(workflow + chat calls).

## Behavior (verified)

- **Bell**: header `NotificationBell` — unread count badge (red), click opens a
  dropdown listing notifications (scrollable, unread section distinguished),
  per-item click → marks read + navigates via `itemPath` deep link,
  "Mark all read" action, link to the full Notifications page.
- **Page**: `/notifications` — tabs `all | unread | read`, paginated list,
  per-item mark-read, mark-all-read, unread count chip; row shows icon per
  `item_type` (`notificationMeta.iconFor`), message, timestamp.
- **Unread badge**: `["unread-count"]` TanStack Query key shared between bell
  and page; invalidations keep both in sync; `refetchInterval: 60_000` polling.
- **Sources**: workflow transitions (submit/decision/return) via
  `emit()` — never for the actor's own action; missed/cancelled calls emit
  `item_type="call"` ("Missed voice|video call from <name>") → `/chat`.
- **i18n**: page/bell chrome localized EN/AR + RTL + dark mode; notification
  message text is server-generated (currently English by existing convention).

## Functional Requirements

- **FR-001**: Every actionable workflow event generates a notification for the
  intended recipient only (never the actor).
- **FR-002**: Notification list is own-scope only; read state is per-recipient.
- **FR-003**: Unread badge = server truth (`GET /api/notifications/?unread=true`
  count); bell dropdown supports unread-only view and "mark all read".
- **FR-004**: Each notification deep-links to its item (`itemPath` per
  `item_type`: request, timesheet, call → `/chat`).
- **FR-005**: Marking read (item or all) updates page, dropdown, and badge in
  sync via shared query keys.
- **FR-006**: Full EN/AR + RTL + dark mode.
- **FR-007**: Notifications and chat unread counts are independent concepts.
- **FR-008**: Missed/cancelled calls produce a notification (see spec 004).
- **FR-009**: Delivery is poll-based (~60 s) plus event-driven cache
  invalidation where a WS event exists (e.g., chat message bumps); a dedicated
  notifications push channel is NOT implemented — acceptable for now, noted as
  deferred.

## Key Files

- Backend: `apps/notifications/{models,services,views,urls}.py`
- Frontend: `components/NotificationBell.tsx`, `features/notifications.tsx`,
  `lib/notificationMeta.tsx`

## Success Criteria

- SC-001: Triggered notifications appear for the recipient (≤60 s poll) and
  never for the actor.
- SC-002: Read/unread state identical between bell, page, and badge.
- SC-003: Deep links land on the related item for every `item_type` in use.
