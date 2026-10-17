# Implementation Plan: Voice & Video Calling

**Status**: ACTIVE — core lifecycle delivered; Phase 8 (production networking)
and final QC remain.

## Architecture

- **Media**: `frontend/src/lib/rtc.ts` `RtcSession` — RTCPeerConnection with
  Google STUN (`stun.l.google.com:19302`), getUserMedia (audio echo-cancel
  / video 640×480), `ontrack` playback, ICE trickle via `call.signal`.
  No TURN — see open issue P8.
- **Signaling**: piggybacked on the existing chat WS (`call.*` events through
  `chat.user.<id>` groups); server stamps `from`, persists lifecycle before
  relay.
- **State**: `Call` row is authoritative; statuses `ringing → active → ended`,
  outcomes `completed/missed/cancelled/declined/failed`. `offer` SDP retained
  while ringing for reconnect replay.
- **Watchdog**: `asyncio` task per `call_id` (`_ring_timers`), 30 s
  (`CHAT_RING_TIMEOUT_SECONDS`); timeout → `finalize_timeout` → MISSED +
  `call.end{reason:"timeout"}` broadcast.
- **UI**: unchanged floating `CallOverlay` + `CallEventMessage` history rows;
  `ChatProvider` mirrors ringing UX with a local timer (+10 s failsafe);
  `startedAt` set on `call.accept` — duration = real talk time.

## Lifecycle (implemented)

```
invite → start_call (RINGING, offer stored, watchdog armed)
  ├─ accept   → answer_call (ACTIVE, answered_at)            [bounce if ended]
  ├─ decline  → end_call (DECLINED)                          [or reason=failed]
  ├─ end      → ringing: CANCELLED (caller) / DECLINED (callee)
  │             active:  COMPLETED (+duration)
  │             reason media|connection|failed → FAILED
  └─ watchdog → finalize_timeout (MISSED) + call.end to both
finalize_call → ENDED, ended_at, duration, ONE call Message,
  caller auto-read, broadcast, callee notification (missed/cancelled)
```

## Phases

1. Call/session state model — `Call` + `Message.kind` *(done)*
2. Signaling — consumer lifecycle + persistence-first relay *(done)*
3. Voice calls — WebRTC audio end-to-end *(done)*
4. Video calls — camera, toggles, remote video *(done)*
5. Incoming-call UX — overlay, replay on reconnect, ghost-close *(done)*
6. Outcomes/history — one event, per-viewer wording, Call back *(done)*
7. Reliability — idempotent finalize, accept-after-end bounce, timeout *(done)*
8. Production networking — **OPEN**: TURN server + multi-worker watchdog
   + Redis channel layer
9. Testing/QC — backend suite done; full nine-scenario E2E done; final polish
   items tracked in tasks.md
