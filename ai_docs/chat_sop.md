# Chat — Developer SOP

## Purpose & business context
1:1 messaging between employees plus WebRTC voice/video calls, floating over the
HR workspace. Calls produce persistent, timestamped history events inside the
conversation (missed / cancelled / declined / completed / failed) that survive
refresh and count toward unread badges.

## Architecture
- **Backend**: Django + Channels (ASGI via Daphne). One WS endpoint
  `ws/chat/` (JWT via `?token=` query param — browsers cannot set headers).
- **Realtime**: in-process channel layer (`InMemoryChannelLayer`) + in-process
  presence set. Groups: `chat.user.<id>` and `chat.presence`.
- **Frontend**: `ChatProvider` (socket + call state machine), `ChatWindow`
  (floating conversation), `CallOverlay` (floating call UI), `ChatBell`
  (header popover), `ChatsPage` (full page), `RtcSession` (WebRTC wrapper,
  STUN only in dev).
- **Signalling**: `call.*` events are relayed peer-to-peer over the socket,
  with `from` server-stamped. As of v1.1 the consumer also *persists* call
  lifecycle transitions.

## Models (v1.1)
### `Call` — one row per call attempt
- `call_id` (client-generated, unique) — the shared identity for WS events.
- `conversation`, `caller`, `callee`, `mode` (audio/video).
- `status`: `ringing → active → ended`. `outcome` set once at finalize:
  `completed | missed | cancelled | declined | failed`.
- `offer`: SDP offer kept **only while ringing** so a reconnecting callee can
  receive a replayed invite; cleared on finalize.
- `answered_at`, `ended_at`, `duration_seconds` (answer→end, real talk time).

### `Message` — gains `kind` (`text`|`call`) + `call` (OneToOne)
Call history is a normal message row with `kind="call"`, empty `body`, sender =
caller. It rides the existing message pipeline: ordering by `created_at`,
unread counting (sender excluded), `last_message`, broadcast — zero extra
plumbing.

## Lifecycle (server-authoritative)
| Event | Server action |
|---|---|
| `call.invite` | `start_call` (idempotent on call_id), caller card re-stamped, ring watchdog armed (30s, `CHAT_RING_TIMEOUT_SECONDS`) |
| `call.accept` | `answer_call` ringing→active; if already ended, acceptor gets `call.end{reason:"ended"}` and nothing is relayed |
| `call.decline` | `end_call` → `declined` (`reason=media` → `failed`) |
| `call.end` while ringing | `cancelled` if sender=caller, `declined` if sender=callee, `failed` on failure reasons |
| `call.end` while active | `completed` (`reason` in media/connection/failed → `failed`) with real duration |
| watchdog fires | `finalize_timeout` → `missed`, then `call.end{reason:"timeout"}` pushed to BOTH users |
| WS (re)connect | `sweep_ringing_for`: stale rings → missed; fresh callee invites replayed with stored offer |

`finalize_call` is idempotent (`select_for_update` + terminal-status check):
cancel-vs-timeout races produce exactly one history event.

## Notification
On `missed`/`cancelled` the callee gets a `Notification`
(`item_type="call"`, `item_id=call.pk`, "Missed voice|video call from <name>").
Frontend `itemPath` maps `call` → `/chat`; icon = PhoneMissed (red).

## Frontend notes
- Caller local timers are UX-only; the backend watchdog is authoritative.
  Caller failsafe ends the call at +10s after the local 30s mark.
- `call.end` from the watchdog carries `from=<caller id>`; the caller's client
  accepts self-`from` for `call.end` only.
- Event wording is per-viewer (`callEventText`): callee sees "Missed voice
  call"; the caller sees "Voice call — No answer" / "Voice call cancelled" /
  "Voice call declined" as appropriate. `completed` shows `mm:ss` duration.
- Call events on the recipient side offer a subtle **Call back** action that
  reuses `startCall` — no second call system.
- Conversation-list previews render call events via `messagePreview`.

## Security
- WS auth = JWT query token; deactivated users rejected.
- Lifecycle transitions only accepted from call participants; signalling only
  relays to existing active users.
- `caller` card and `from` are always server-built.

## Migration notes
- `0002_message_kind_alter_message_body_call_message_call` — adds `kind`,
  nullable `call` 1:1, `body` default "".
- `0003_call_offer` — adds `Call.offer` JSONField.
- **Postgres dev DB**: migrations must run inside the compose backend container
  (`docker exec cds-business-backend-1 python manage.py migrate`) — the host
  `db.sqlite3` is not what the running stack uses.
- `apps/chat/migrations.root-owned/` — leftover root-owned dir from the
  container; safe to delete with `sudo rm -rf`.

## Test scenarios
- **Happy path**: call → accept → either side ends → `completed` + duration on
  both histories.
- **Cancel**: caller ends while ringing → callee "Missed call" + unread +1,
  caller "cancelled" + no unread.
- **Decline / busy / media-fail decline** → `declined` / `declined` / `failed`.
- **Timeout**: 30s watchdog → `missed`, both overlays close, callee notified.
- **Reconnect**: callee socket drops mid-ring → invite replayed on reconnect.
- **Race**: caller cancel + watchdog both fire → single event.
- **Security**: non-participant `call.end` ignored; pre-auth WS closed 4401.
- Backend: `backend/tests/integration/test_chat.py` (24 tests).

## Known limitations
- Presence + ring watchdogs are in-process — single-worker only; production
  needs `CHANNEL_LAYER_REDIS_URL` + a shared scheduler for timeouts.
- Early ICE candidates before the invite are dropped; usually harmless (later
  candidates still arrive) but could delay connect on hostile networks.
- No TURN — calls across restrictive NATs may fail (`failed` outcome).

## v1.2 — Conversation list = real activity only (2026-10-16)

- Root cause of "directory-like" dropdown: the old `pickUser` POSTed
  `/api/chat/conversations/` on contact selection, persisting an empty
  conversation for every employee ever clicked. Those shells rendered
  "Start the conversation" in the Chats dropdown.
- Fix: `GET /api/chat/conversations/` now lists only conversations having
  ≥1 message; detail/message endpoints stay reachable for empty shells.
  `pickUser` opens an in-memory draft (`id=0`) and the conversation is
  materialized lazily via `ensureConversation` on the first send or call.
- Cleanup: `Conversation.objects.filter(messages__isnull=True).delete()`
  was run against the dev Postgres — only zero-message shells removed, no
  history lost.
- New conversation appearing live: receiver gets it via `chat.message` +
  CONVERSATIONS_KEY invalidation; sender gets it via the same invalidation
  after materialization.
