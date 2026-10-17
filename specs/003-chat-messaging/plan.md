# Implementation Plan: Chat & Messaging

**Status**: COMPLETED (retroactive documentation)

## Architecture

- **Transport**: single WS `ws/chat/` (`ChatConsumer`, JWT `?token=` auth via
  `JwtAuthMiddleware`). Groups: `chat.user.<id>` per user + `chat.presence`.
- **REST**: `ConversationViewSet` (list filtered to conversations with
  messages; `create` = `get_or_create_direct`), `MessageListCreateView`
  (pagination desc → client asc), `read`, `unread`, `contacts`, `presence`,
  `calls/failed`.
- **Services**: `services.post_message` bumps `last_message_at`, marks sender
  read, broadcasts `chat.message` to both `chat.user.<id>` groups.
- **Lazy creation**: the frontend opens an in-memory draft (`id=0`) when a
  directory contact is picked; `ensureConversation` persists the conversation
  only on first send or call — empty shells never surface in lists.
- **Realtime → caches**: `ChatProvider` handles `chat.message`/`chat.read`/
  `presence`/call events; updates `messagesKey`, `CONVERSATIONS_KEY`,
  `CHAT_UNREAD_KEY` (and `["unread-count"]` where applicable).
- **Presence**: in-process presence set broadcast on connect/disconnect;
  `GET /api/chat/presence/` fallback. Multi-worker limitation noted.

## Data model deltas (migrations)

- `0002`: `Message.kind`, `body` default "", `call` OneToOne; `Call` table.
- `0003`: `Call.offer` (ringing-only SDP for invite replay).

## Frontend structure

- `features/chat/ChatProvider.tsx` — context: socket lifecycle, call state
  machine, cache fanout.
- `features/chat/ChatWindow.tsx` — floating window + `ChatBody` (messages +
  composer); remounts per conversation.
- `features/chat/CallEvent.tsx` + `callEventText.ts` — call-event rendering,
  per-viewer labels, `messagePreview` for list previews.
- `components/ChatBell.tsx` — dropdown (conversations | New message directory).
- `features/chat/ChatsPage.tsx` — full `/chat` page.
- `lib/chatSocket.ts` — socket wrapper; `lib/rtc.ts` — WebRTC (spec 004).

## Constraints

- `InMemoryChannelLayer` + in-process presence/ring-timers → single-worker
  dev scope. Production needs `CHANNEL_LAYER_REDIS_URL` + a shared scheduler
  (see 004 Phase 8).
