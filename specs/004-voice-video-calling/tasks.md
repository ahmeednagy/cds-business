# Tasks: Voice & Video Calling

**Status**: Phases 1–7 COMPLETED (E2E-verified 2026-10-16, two real accounts,
all nine scenarios). Phase 8 open — required before production deployment.

## Phase 1: Call/session state model *(done)*

- [x] V001 `Call` model + `Message.kind="call"` + `call` OneToOne (migration
  0002); `Call.offer` (migration 0003)

## Phase 2: Signaling *(done — depends on Phase 1)*

- [x] V002 Consumer intercepts `call.invite/accept/decline/end`, persists
  before relay, server-stamps `from`/`caller`
- [x] V003 `start_call`/`answer_call`/`end_call`/`finalize_call` services
  (idempotent, row-locked)

## Phase 3: Voice calls *(done)*

- [x] V004 `RtcSession` audio, mute, speaker toggle, incoming/outgoing overlay
- [x] V005 Accept → answered_at → connected state on both clients

## Phase 4: Video calls *(done — depends on Phase 3)*

- [x] V006 getUserMedia video, remote `<video>` playback, camera toggle

## Phase 5: Incoming-call UX *(done)*

- [x] V007 Floating incoming overlay (accept/decline), closes on
  cancel/decline/timeout/end — no ghost popups
- [x] V008 Invite replay on WS reconnect while ringing (`sweep_ringing_for`)

## Phase 6: Outcomes / history *(done — depends on 003 Phase 5)*

- [x] V009 Outcome mapping per spec table (MISS/CANCEL/DECLINE/COMPLETE/FAIL)
- [x] V010 `CallEventMessage` per-viewer wording + Call back + previews +
  EN/AR strings
- [x] V011 Missed/cancelled → callee `Notification` (item_type=call → /chat);
  caller never self-unread

## Phase 7: Reliability / error handling *(done)*

- [x] V012 Server watchdog 30 s timeout → MISSED + `call.end` to both
- [x] V013 Race-safe finalize (cancel vs timeout → single event)
- [x] V014 Accept-after-end bounce; self-`from` `call.end` accepted on caller
- [x] V015 Pre-invite media failure → `POST /api/chat/calls/failed/` (FAILED)

## Phase 8: Production networking *(OPEN — deployment blocker)*

- [ ] V016 TURN server configuration (coturn or managed) + `RTC_CONFIG`
  env wiring — calls across restrictive NATs currently fail
- [ ] V017 Shared ring-timeout scheduler for multi-worker (Celery beat or
  Redis expiry listener) replacing in-process `_ring_timers`
- [ ] V018 Redis channel layer (`CHANNEL_LAYER_REDIS_URL`) + shared presence
  backend (joint with 005 C017)

## Phase 9: Testing / QC *(partially done)*

- [x] V019 Backend lifecycle tests (`test_chat.py`: outcomes, idempotency,
  unread, notification, serialization)
- [x] V020 Two-context live E2E: all nine voice/video scenarios, refresh
  persistence, no duplicates, screenshots
- [ ] V021 Media-denied UX polish + explicit `failed` path E2E (hard to fake
  permission denial in headless runs — manual check pending)
- [ ] V022 Multi-tab behavior review (same user, two tabs ringing)
