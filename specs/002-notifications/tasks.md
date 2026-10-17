# Tasks: Notifications

**Status**: COMPLETED — retroactive task list; all items verified implemented.
Open/deferred items are listed explicitly.

## Phase 1: Backend foundation *(depends on 001 Foundational)*

- [x] N001 `Notification` model (recipient, item_type/item_id, message,
  read_at) + `emit()` helper — never notifies the actor
- [x] N002 Endpoints: `GET /api/notifications/` (`unread` filter, pagination),
  `POST /{id}/read/`, `POST /read-all/`
- [x] N003 Tests: `tests/integration/test_notifications.py` — emission, own
  scope, read/read-all, self-action suppression

## Phase 2: Header bell + dropdown

- [x] N004 `NotificationBell` — unread badge, dropdown list with internal
  scrolling, per-item mark-read + deep-link, "Mark all read", link to page
- [x] N005 60 s polling + shared `["unread-count"]` query key
- [x] N006 `notificationMeta.tsx` — per-`item_type` icon + `itemPath` routes

## Phase 3: Notifications page

- [x] N007 `/notifications` page — all/unread/read tabs, pagination, badges
- [x] N008 EN/AR + RTL + dark mode for bell and page

## Phase 4: Event sources

- [x] N009 Workflow events emit notifications (submit/decision/return)
- [x] N010 Missed/cancelled call notifications (`item_type="call"`, → `/chat`)

## Deferred

- [ ] N011 Realtime push for notifications via WS group (`notification.new`
  event on `chat.user.<id>`) — currently poll-based; add only if needed
- [ ] N012 Localized notification message templates server-side (currently
  English strings)
