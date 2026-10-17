# Tasks: Chat & Messaging

**Status**: COMPLETED — all phases verified live (two authenticated contexts,
persisted after refresh, no duplicates). Deferred production-hardening items
live in spec 004 Phase 8 (shared with calling).

## Phase 1: Messaging foundation *(done)*

**Objective**: persisted direct conversations + messages + REST APIs.
Depends on: 001 Foundational (auth, RBAC, users).

- [x] C001 `Conversation`, `ConversationParticipant`, `Message` models +
  migrations
- [x] C002 `get_or_create_direct` (one direct conv per pair) + `post_message`
  (bump `last_message_at`, sender auto-read, broadcast)
- [x] C003 REST: conversations list/create, messages list/post, `read`,
  `unread`, `contacts`, `presence` endpoints
- [x] C004 Integration tests: `test_chat.py` (creation, scoping, empty-body
  rejection, unread math, read semantics)

## Phase 2: Conversation UX *(done)*

**Objective**: entry points and lists reflect real conversations only.
Depends on: Phase 1.

- [x] C005 `ChatBell` dropdown: conversations w/ preview + unread badge,
  sort by activity, empty state, "View all chats" → `/chat`
- [x] C006 `New message` → employee directory (search, name, job title,
  avatar) — picks open a draft, never persist empty convs
- [x] C007 Floating `ChatWindow` (open/minimize/close) + `ChatsPage`
- [x] C008 Fix: list query filters `messages__isnull=False`; removed
  historical empty shells (7 rows, zero history)

## Phase 3: Realtime messaging *(done)*

**Objective**: instant delivery + reconnect resilience.
Depends on: Phase 1 (persistence before relay).

- [x] C009 `ChatConsumer` + `chatSocket.ts`: JWT auth, `chat.user.<id>`
  groups, message/read/presence relay, reconnect handling
- [x] C010 `ChatProvider` cache fanout on `chat.message`/`chat.read`
- [x] C011 Presence broadcast + presence endpoint fallback

## Phase 4: Read / unread *(done)*

**Objective**: unread truth is server-side and realtime.
Depends on: Phase 3.

- [x] C012 `last_read_at` semantics → `unread_count` in serializer +
  `/api/chat/unread/` total → header badge
- [x] C013 `chat.read` broadcast syncs peer read state live

## Phase 5: Chat history / system events *(done)*

**Objective**: call attempts render as persisted events among messages.
Depends on: Phase 1 + spec 004 lifecycle.

- [x] C014 `Message.kind="call"` + `call` link; serializer exposes
  `call{call_id,mode,outcome,duration_seconds}`
- [x] C015 `CallEventMessage` centered event UI (red vs neutral tone),
  `messagePreview` for dropdown/page previews, Call back action
- [x] C016 EN/AR strings for all event labels (`chat.events.*`)

## Phase 6: Deferred / production

- [ ] C017 Multi-worker channel layer (Redis) + shared presence/scheduler —
  owned jointly with 004 Phase 8
