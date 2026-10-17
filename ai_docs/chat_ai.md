## MODULE: chat
## VERSION: 1.2
## LAST_UPDATED: 2026-10-16

### MODELS
- Conversation | kind=direct | participants m2m via ConversationParticipant | last_message_at
- ConversationParticipant | conversation+user uniq | last_read_at drives unread
- Message | kind:text/call | body (blank ok for call) | call → OneToOne Call | sender=caller for call events
- Call | call_id uniq (client-generated) | conversation,caller,callee | mode:audio/video | status:ringing/active/ended | outcome:completed/missed/cancelled/declined/failed | offer=JSON SDP only while ringing | answered_at,ended_at,duration_seconds

### METHODS
- services.get_or_create_direct(a,b) → Conversation | reuse existing direct conv
- services.post_message(conv,sender,body) → Message | bumps last_message_at, marks sender read, broadcasts chat.message
- services.start_call(caller,callee_id,call_id,mode,offer) → Call|None | get_or_create on call_id
- services.answer_call(call_id) → bool | ringing→active, sets answered_at
- services.end_call(call_id,sender_id,event_type,reason) → Message|None | participant-only, idempotent
- services.finalize_call(call,outcome) → Message|None | first terminal transition wins; writes ONE call Message; caller auto-read; missed/cancelled → Notification to callee
- services.finalize_timeout(call_id) → Call|None | MISSED if still ringing
- services.sweep_ringing_for(user_id) → [Call] | on WS connect: stale rings → MISSED, fresh callee rings returned for invite replay
- services.caller_card(user) → dict | server-built caller identity for invite payload
- services.broadcast_message/broadcast_read/signal | channel-layer fanout to chat.user.<id> groups

### CONSUMER (apps/chat/consumers.py)
- CALL_EVENTS relayed: call.invite/accept/decline/end/signal | server stamps from=user.id
- call.invite → start_call + overwrite caller card + arm ring watchdog (asyncio task, RING_TIMEOUT_SECONDS=settings.CHAT_RING_TIMEOUT_SECONDS=30)
- call.accept → answer_call; if already ended → push call.end{reason:"ended"} back to acceptor, skip relay
- call.decline/call.end → end_call maps outcome; relayed regardless
- watchdog → finalize_timeout(MISSED) + sends call.end{reason:"timeout",from:caller} to BOTH users
- connect → sweep_ringing_for + replay fresh invites (call.invite with stored sdp offer)
- _ring_timers: module dict call_id→task | dev-scope (single process); prod needs shared scheduler

### VIEWS/API
- GET /api/chat/conversations/ | lists ONLY convs with ≥1 message (empty shells hidden); POST {user_id} reuses/creates direct conv (called lazily on first send/call)
- GET/POST /api/chat/conversations/{id}/messages/ | desc paginated, kind+call fields on each
- POST /api/chat/conversations/{id}/read/ | sets last_read_at, broadcasts chat.read
- GET /api/chat/unread/ → {count} | POST /api/chat/calls/failed/ {user_id,mode} → persists FAILED call event
- GET /api/chat/contacts/?search= | GET /api/chat/presence/?ids=

### WS EVENTS (server→client)
- chat.message {conversation_id, message{kind,call{call_id,mode,outcome,duration_seconds}}}
- chat.read {conversation_id, reader_id}
- call.event → forwarded verbatim (call.invite/accept/decline/end/signal)
- presence {user_id, online}

### SECURITY
- JWT via ?token= query (JwtAuthMiddleware) | 4401 close on bad auth
- Conversation access = membership only | end_call restricted to participants
- caller card + from are server-stamped, never trusted from client

### FRONTEND
- ChatProvider: WS lifecycle, call state machine, chat.message cache updates, unread invalidation
- Draft conversation: id=0 (DRAFT_CONVERSATION_ID) when picked from directory; materialized via ensureConversation on first send/call; Chats lists never show empty convs
- ChatWindow/ChatBody: bubbles + CallEventMessage for kind=call | call-back → startCall(peer,mode)
- CallEvent.tsx + callEventText.ts: per-viewer labels (mine=caller vs callee), tone red/green
- CallOverlay: floating call UI (unchanged design)
- call.end from watchdog has from=caller_id — caller accepts self-from on call.end only
- Call failure before invite → POST /api/chat/calls/failed/

### DEPENDENCIES
- channels + InMemoryChannelLayer (dev) / channels_redis (prod)
- apps.notifications for missed-call Notification (item_type="call", links /chat)

### KNOWN_CONSTRAINTS
- Ring watchdog + presence are in-process; multi-worker deploys need Redis layer + shared scheduler
- ICE candidates arriving before the invite are dropped (no buffering)
- Notification message text is server-generated English (matches existing convention)
- Call duration = answered_at→ended_at (accept time, not media connect time)
- migrations.root-owned/ dir left in apps/chat — remove with sudo

### CHANGE_LOG
- 2026-10-16 | added Call model, Message.kind/call, server-side lifecycle, ring timeout, missed-call notifications, call-event UI, invite replay on reconnect
- 2026-10-16 | Chats list = conversations with activity only; lazy draft conv creation; deleted pre-created empty convs; call events valid as last_message preview
