# Implementation Plan: Notifications

**Status**: COMPLETED (retroactive documentation)

## Architecture

- **Model**: `Notification` — recipient, `item_type` + `item_id` (generic
  pointer), `message`, `read_at`, `created_at`.
- **Emitters**: `services.emit()` called inside workflow transitions
  (request/timesheet submit/approve/reject/return) and directly by the chat
  service for missed/cancelled calls.
- **API**: `GET /api/notifications/` (paginated, `unread=true` filter),
  `POST /{id}/read/`, `POST /read-all/`.
- **Frontend**: TanStack Query keys `["notifications", …]` +
  `["unread-count"]`; 60 s `refetchInterval`; WS `chat.message` events
  invalidate chat unread (separate concept, spec 003).
- **Deep links**: `lib/notificationMeta.tsx` maps `item_type` → icon + path
  (`itemPath`). `call` → `/chat`; request/timesheet → detail routes.

## Known gap / deferred

- No push channel for notifications (poll only). If realtime notification
  delivery is later required, extend the existing `chat.user.<id>` WS group
  with a `notification.new` event — do not create a second socket.
- `message` text is generated server-side in English only.
