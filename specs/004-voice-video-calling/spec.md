# Feature Specification: Voice & Video Calling

**Feature Branch**: `004-voice-video-calling`

**Created**: 2026-10-15 · **Audited/documented**: 2026-10-16

**Status**: ACTIVE — core lifecycle implemented and E2E-verified across all
nine required scenarios; remaining work is production hardening (Phase 8) and
final polish items in `tasks.md`.

**Input**: WebRTC voice/video calls between two employees, integrated with the
chat conversation (spec 003): signaling over the chat WebSocket, floating call
overlay, persisted call-history events, missed-call notifications.

## Call outcome semantics (authoritative)

One call attempt = one `Call` row = one persisted call event
(`Message(kind="call")`). The outcome is decided once, server-side, by the
first terminal transition; wording differs per viewer:

| Situation | Caller sees | Recipient sees |
|---|---|---|
| Ring timeout (no answer) | Voice call — No answer | **Missed voice call** |
| Caller cancels while ringing | **Voice call cancelled** | **Missed voice call** |
| Callee declines | Voice call declined | Declined voice call |
| Callee ends while ringing | Voice call declined | Declined voice call |
| Connected, either ends | Voice call · mm:ss | Voice call · mm:ss |
| Media/connection failure | Voice call failed | Voice call failed |

(Video variants use "video call" wording everywhere; all strings localized
EN/AR — `chat.events.*`.)

- **MISSED** = callee never answered; unread for callee + notification.
- **CANCELLED** = caller ended before answer; for the *callee* it renders as
  missed (same badge/notification semantics).
- **DECLINED** = callee actively declined or ended while ringing.
- **COMPLETED** = `active` call ended; `duration_seconds` measured from
  `answered_at` (accept), never from ringing.
- **FAILED** = media/connection error (e.g., permission denied before invite
  → `POST /api/chat/calls/failed/`; mid-call failure via `call.end`
  `reason ∈ media|connection|failed`).

## User Stories

### US1 - Start and receive a call (P1)

A user clicks voice/video on an open conversation; the callee's floating
overlay rings with the caller card; caller hears the outgoing state.

### US2 - Accept / decline / cancel (P1)

Callee accepts (→ media negotiation → connected timer starts at answer) or
declines (caller notified instantly); caller may cancel while ringing —
callee's overlay closes immediately.

### US3 - Ring timeout (P1)

Server watchdog (~30 s, `CHAT_RING_TIMEOUT_SECONDS`) finalizes unanswered
calls MISSED and pushes `call.end{reason:"timeout"}` to both clients — the
outcome never depends solely on a client timer.

### US4 - Call history + notifications (P1)

Every attempt lands in the conversation as one localized event (table above).
Recipient unread/badge/notifications follow spec 002/003. Call back on missed
events restarts the same call type.

### US5 - Reliability (P2)

Reconnecting mid-ring replays the stored invite (offer kept on the `Call`
row); stale rings are swept to MISSED on reconnect; finalization is idempotent
(cancel vs timeout races produce exactly one event); a stale accept is
bounced (`call.end{reason:"ended"}`).

## Functional Requirements

- **FR-001**: One `Call` per attempt; `call_id` (client-generated) is the
  shared identity across WS events; `start_call` idempotent on it.
- **FR-002**: Lifecycle transitions only via the consumer, which persists
  before relaying — no outcome is ever lost to a dropped socket.
- **FR-003**: `from`/`caller` always server-stamped; only call participants
  may send lifecycle events for a call.
- **FR-004**: `answered_at` on `RINGING→ACTIVE`; duration = answer→end.
- **FR-005**: `finalize_call` is idempotent (`select_for_update` + terminal
  check); one call event total.
- **FR-006**: Watchdog MISSED at ~30 s; pushes `call.end{reason:timeout}` to
  both users.
- **FR-007**: Ringing invite replay on reconnect (offer stored until finalize).
- **FR-008**: Missed/cancelled → callee `Notification` (`item_type=call` →
  `/chat`); caller never self-notifies / self-unreads.
- **FR-009**: Floating overlay preserved: ringing (accept/decline), outgoing
  (end), connecting (timer starts at accept), connected (mute, camera toggle,
  speaker toggle for audio, end). All overlays close immediately on remote
  end/cancel/timeout.
- **FR-010**: WebRTC via `RtcSession` — getUserMedia (audio echo-cancelled /
  video), `ontrack` media, ICE candidates relayed via `call.signal`;
  Google STUN only in dev.
- **FR-011**: TURN is REQUIRED for production reachability — not yet deployed.
- **FR-012**: Ring watchdogs + presence are in-process asyncio — single-worker
  dev scope; production needs a shared scheduler (e.g., Celery beat / Redis
  timers).

## Key Entities

- `Call` — `call_id`, conversation, caller, callee, `mode`, `status`
  (ringing/active/ended), `outcome`, `offer` (ringing-only SDP),
  `answered_at`, `ended_at`, `duration_seconds`; linked 1:1 from
  `Message.kind=call`.
- WS events: `call.invite | call.accept | call.decline | call.end | call.signal`.

## Success Criteria

- SC-001: All nine required scenarios verified with two real accounts —
  voice/video × {timeout, cancel, decline, accept→caller-ends,
  accept→callee-ends} — one event each, correct per-viewer wording, overlays
  close, history persists after refresh. **(done 2026-10-16)**
- SC-002: Zero duplicate call events under cancel/timeout races.
- SC-003: Completed calls show real connected duration.
- SC-004: Missed/cancelled raises callee unread + notification; caller never
  self-unreads.
- SC-005 (open): production reachability requires TURN — not deployed.
