# Feature Specification: Chat & Messaging

**Feature Branch**: `003-chat-messaging`

**Created**: 2026-10-15 · **Audited/documented**: 2026-10-16

**Status**: COMPLETED — implemented and verified live with real accounts
(Ahmed Nagy ↔ Ahmed Mahdy), persisted history verified after refresh.

**Input**: Direct 1:1 messaging between employees — conversations, messages,
realtime delivery, unread state, floating chat UX. Voice/video calls are
specified separately in `004-voice-video-calling`; this spec owns the
conversation/message layer including call-history events rendered as messages.

## Core rule

> **Chats lists = EXISTING conversations only.** A user appears in the Chats
> dropdown or the Chats page ONLY if a real conversation with ≥1 message
> already exists. The employee directory is reachable exclusively through
> **New message**, which starts a new conversation lazily — picking a person
> must NOT persist a conversation until a message or call actually happens.

## User Stories

### US1 - Direct conversations (P1)

A user opens a direct conversation with a colleague; the same conversation is
reused for subsequent messages (no duplicates per pair). Conversations are
created lazily on first real activity (first message or call).

**Acceptance**:

1. Sending the first message creates the conversation; the peer then sees it.
2. Re-picking the same person reuses the same conversation (`get_or_create`).
3. Empty conversations never appear in any Chats list.

### US2 - Chat entry points (P1)

Header **chat bell** opens a dropdown of existing conversations (latest
activity + unread badge per row, sorted by latest activity, empty state "No
conversations yet — start a new message to begin", "View all chats" →
`/chat` page). **New message** in the dropdown opens the employee directory
(search, name, job title, avatar). Clicking a conversation opens a floating
`ChatWindow`; the `/chat` page shows the full two-pane view.

**Acceptance**:

1. The dropdown never lists employees without an existing conversation.
2. The directory is reachable only via New message and shows all eligible
   active accounts.
3. Conversation lists sort by `last_message_at` desc — newest activity first.

### US3 - Messaging (P1)

Text messages send and receive in real time; history is paginated (newest
first server-side, ascending in the window); composer supports emoji.

**Acceptance**:

1. A message appears in the sender's window and in the recipient's open window
   (and dropdown preview) without refresh.
2. History survives reload; pagination loads older pages correctly.
3. Empty/whitespace bodies are rejected (400).

### US4 - Read / unread (P1)

`last_read_at` on `ConversationParticipant` drives `unread_count`
(messages strictly newer than `last_read_at`, excluding own). Opening a
conversation marks it read; the read event syncs the peer's window and the
header chat badge (`/api/chat/unread/` total).

**Acceptance**:

1. Incoming messages raise the header chat badge and the conversation badge in
   real time.
2. Opening the conversation clears its unread and updates badges for both
   sides.
3. The sender's own messages never count as unread for the sender.

### US5 - Presence (P2)

Online/offline status of the conversation peer shows in the chat header and
the directory (live via `chat.presence` group broadcast + `GET /api/chat/
presence/?ids=` fallback).

### US6 - Conversation history events (P2)

Call attempts produce `Message(kind="call")` rows rendered as compact
centered system events (see spec 004 for outcome semantics). Call events
participate in unread counts, ordering, previews, and persistence exactly like
text messages.

**Acceptance**:

1. Call events render inline by timestamp, styled distinctly from bubbles.
2. The conversation preview shows the call event label (e.g., "Missed voice
   call"), never an empty body.

## Functional Requirements

- **FR-001**: Direct conversations only; exactly one per user pair.
- **FR-002**: Conversation access = membership; non-members get 404-masking.
- **FR-003**: `GET /api/chat/conversations/` lists ONLY conversations with ≥1
  message, sorted by latest activity; POST `{user_id}` returns the shared
  direct conversation (called lazily by the client).
- **FR-004**: `GET/POST /api/chat/conversations/{id}/messages/` — paginated,
  text body required for `kind=text`.
- **FR-005**: `POST /api/chat/conversations/{id}/read/` sets `last_read_at`
  and broadcasts `chat.read`.
- **FR-006**: New messages broadcast `chat.message` to both members'
  `chat.user.<id>` groups, updating open windows, previews, and unread badges
  without refresh.
- **FR-007**: `GET /api/chat/contacts/?search=` returns eligible active users
  (for the New message directory only — not a conversations list).
- **FR-008**: `GET /api/chat/presence/?ids=` + presence broadcasts.
- **FR-009**: Call events are normal `Message` rows (`kind=call` + linked
  `Call`); one event per call attempt; they count toward unread for the
  recipient, not the actor.
- **FR-010**: All UI strings localized EN/AR; RTL renders correctly.
- **FR-011**: WS auth via JWT `?token=`; deactivated users rejected; `from`
  is always server-stamped.

## Key Entities

- `Conversation` (kind=direct, `last_message_at`)
- `ConversationParticipant` (conversation+user, `last_read_at`)
- `Message` (`kind` ∈ text|call, `body`, `call` OneToOne → `Call` [spec 004])
- Frontend: `ChatProvider` (socket + state), `ChatWindow`, `ChatBell`,
  `ChatsPage`, `chatSocket.ts`

## Success Criteria

- SC-001: Chats lists contain zero "directory" rows — 100% real conversations.
- SC-002: A first message makes the conversation appear on both sides without
  refresh.
- SC-003: Unread counts/badges stay correct across send, read, refresh.
- SC-004: No duplicate conversations per pair; no duplicate messages on
  reconnect.
