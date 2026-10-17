"""Chat WebSocket consumer.

Dev-scope presence: an in-process registry of connected user ids. Accurate for
the single-process dev server; multi-process deployments need a shared
presence backend (e.g. Redis) — see ai_docs.

The same in-process caveat applies to call ring-timeout watchdogs: they are
asyncio tasks in this process. That is fine for dev; a multi-worker deploy
should move timeout enforcement to a shared scheduler.
"""

import asyncio

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.layers import get_channel_layer

from apps.accounts.models import User

from . import services
from .services import user_group

_online: set[int] = set()

# call_id -> asyncio.Task that finalizes the call as MISSED when ringing
# outlives RING_TIMEOUT_SECONDS. Cancelled on any terminal signal.
_ring_timers: dict[str, asyncio.Task] = {}


def online_user_ids() -> set[int]:
    return set(_online)


# Call signalling event types relayed peer-to-peer. The payload is forwarded
# verbatim plus the authenticated sender id — never trust client-supplied from.
CALL_EVENTS = {
    "call.invite",
    "call.accept",
    "call.decline",
    "call.end",
    "call.signal",  # WebRTC offer/answer/ICE
}


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.user_id = user.id
        self.group = user_group(user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.channel_layer.group_add("chat.presence", self.channel_name)
        _online.add(user.id)
        await self.accept()
        await self._broadcast_presence(user.id, True)
        await self._replay_ringing_invites()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)
            await self.channel_layer.group_discard(
                "chat.presence", self.channel_name
            )
        if getattr(self, "user_id", None) is not None:
            _online.discard(self.user_id)
            await self._broadcast_presence(self.user_id, False)

    async def receive_json(self, content, **kwargs):
        """Client → server: call signalling, relayed + persisted."""
        ctype = content.get("type")
        if ctype not in CALL_EVENTS:
            return
        try:
            peer_id = int(content.get("to"))
        except (TypeError, ValueError):
            return
        if peer_id == self.user_id or not await self._allowed_peer(peer_id):
            return

        call_id = content.get("callId")
        if call_id and not await self._apply_lifecycle(
            ctype, str(call_id), peer_id, content
        ):
            return

        payload = {
            k: v for k, v in content.items() if k not in ("to", "from")
        }
        payload["from"] = self.user_id
        await self.channel_layer.group_send(
            user_group(peer_id), {"type": "call.event", "event": payload}
        )

    # ---- call lifecycle persistence (server-authoritative) ----

    async def _apply_lifecycle(self, ctype, call_id, peer_id, content):
        """Persist state transitions. Runs before relaying so the outcome
        is recorded even if the peer's socket is gone.

        Returns False when the event must NOT be relayed (e.g. an accept
        for an already-ended call — the acceptor gets call.end instead so
        their call UI closes instead of waiting forever)."""
        if ctype == "call.invite":
            call = await database_sync_to_async(services.start_call)(
                caller=self.scope["user"],
                callee_id=peer_id,
                call_id=call_id,
                mode=content.get("mode"),
                offer=content.get("sdp"),
            )
            if call is not None:
                # Never trust the client-supplied caller card.
                content["caller"] = await database_sync_to_async(
                    services.caller_card
                )(self.scope["user"])
                self._arm_ring_watchdog(call_id, call.caller_id, call.callee_id)
        elif ctype == "call.accept":
            if await database_sync_to_async(services.answer_call)(call_id):
                _cancel_ring_timer(call_id)
            else:
                await self.channel_layer.group_send(
                    self.group,
                    {
                        "type": "call.event",
                        "event": {
                            "type": "call.end",
                            "callId": call_id,
                            "from": peer_id,
                            "reason": "ended",
                        },
                    },
                )
                return False
        elif ctype in ("call.decline", "call.end"):
            await database_sync_to_async(services.end_call)(
                call_id,
                sender_id=self.user_id,
                event_type=ctype,
                reason=content.get("reason"),
            )
            _cancel_ring_timer(call_id)
        return True

    async def _replay_ringing_invites(self):
        """Store-and-forward: a callee whose socket dropped mid-ring gets
        the invite again on reconnect; stale rings finalize as MISSED."""
        fresh = await database_sync_to_async(services.sweep_ringing_for)(
            self.user_id
        )
        for call in fresh:
            await self.send_json(
                {
                    "type": "call.invite",
                    "callId": call.call_id,
                    "mode": call.mode,
                    "sdp": call.offer,
                    "caller": await database_sync_to_async(
                        services.caller_card
                    )(call.caller),
                    "from": call.caller_id,
                }
            )

    def _arm_ring_watchdog(self, call_id, caller_id, callee_id):
        _cancel_ring_timer(call_id)
        _ring_timers[call_id] = asyncio.ensure_future(
            self._ring_watchdog(call_id, caller_id, callee_id)
        )

    async def _ring_watchdog(self, call_id, caller_id, callee_id):
        """Authoritative no-answer timeout (not a frontend setTimeout)."""
        try:
            await asyncio.sleep(services.RING_TIMEOUT_SECONDS)
        except asyncio.CancelledError:
            return
        _ring_timers.pop(call_id, None)
        call = await database_sync_to_async(services.finalize_timeout)(call_id)
        if call is None:
            return  # already ended by a signal — nothing to do
        layer = get_channel_layer()
        if layer is None:
            return
        event = {
            "type": "call.end",
            "callId": call_id,
            "from": caller_id,
            "reason": "timeout",
        }
        for uid in (caller_id, callee_id):
            await layer.group_send(
                user_group(uid), {"type": "call.event", "event": event}
            )

    # ---- group event handlers (server → client) ----

    async def chat_message(self, event):
        await self.send_json(
            {
                "type": "chat.message",
                "conversation_id": event["conversation_id"],
                "message": event["message"],
            }
        )

    async def chat_read(self, event):
        await self.send_json(
            {
                "type": "chat.read",
                "conversation_id": event["conversation_id"],
                "reader_id": event["reader_id"],
            }
        )

    async def call_event(self, event):
        await self.send_json(event["event"])

    async def _broadcast_presence(self, user_id, online):
        await self.channel_layer.group_send(
            "chat.presence",
            {"type": "presence.event", "user_id": user_id, "online": online},
        )

    async def presence_event(self, event):
        await self.send_json(
            {
                "type": "presence",
                "user_id": event["user_id"],
                "online": event["online"],
            }
        )

    @database_sync_to_async
    def _allowed_peer(self, peer_id):
        return User.objects.filter(pk=peer_id, is_active=True).exists()


def _cancel_ring_timer(call_id):
    task = _ring_timers.pop(call_id, None)
    if task is not None:
        task.cancel()
