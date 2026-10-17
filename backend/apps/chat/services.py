from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.accounts.models import User

from .models import Call, Conversation, ConversationParticipant, Message

RING_TIMEOUT_SECONDS = getattr(settings, "CHAT_RING_TIMEOUT_SECONDS", 30)

# Decline/end reasons that mean the call failed rather than was refused.
FAILURE_REASONS = {"media", "connection", "failed"}


def user_group(user_id) -> str:
    return f"chat.user.{user_id}"


def get_or_create_direct(user, other):
    """Reuse an existing direct conversation between the two users."""
    shared = (
        Conversation.objects.filter(kind=Conversation.Kind.DIRECT)
        .filter(memberships__user=user)
        .filter(memberships__user=other)
        .first()
    )
    if shared is not None:
        return shared
    with transaction.atomic():
        conv = Conversation.objects.create(kind=Conversation.Kind.DIRECT)
        ConversationParticipant.objects.bulk_create(
            [
                ConversationParticipant(conversation=conv, user=user),
                ConversationParticipant(conversation=conv, user=other),
            ]
        )
    return conv


def post_message(conversation, sender, body):
    with transaction.atomic():
        msg = Message.objects.create(
            conversation=conversation, sender=sender, body=body
        )
        conversation.last_message_at = msg.created_at
        conversation.save(update_fields=["last_message_at", "updated_at"])
        # Sending counts as reading: never show your own messages as unread.
        ConversationParticipant.objects.filter(
            conversation=conversation, user=sender
        ).update(last_read_at=timezone.now())
    broadcast_message(msg)
    return msg


def broadcast_message(msg):
    from .serializers import MessageSerializer

    payload = MessageSerializer(msg).data
    layer = get_channel_layer()
    if layer is None:
        return
    for uid in msg.conversation.memberships.values_list("user_id", flat=True):
        async_to_sync(layer.group_send)(
            user_group(uid),
            {
                "type": "chat.message",
                "conversation_id": msg.conversation_id,
                "message": payload,
            },
        )


def broadcast_read(conversation, reader):
    layer = get_channel_layer()
    if layer is None:
        return
    for uid in conversation.memberships.exclude(user=reader).values_list(
        "user_id", flat=True
    ):
        async_to_sync(layer.group_send)(
            user_group(uid),
            {
                "type": "chat.read",
                "conversation_id": conversation.id,
                "reader_id": reader.id,
            },
        )


def signal(peer_id, payload):
    """Relay call-signalling payloads to a single user group."""
    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(user_group(peer_id), payload)


# ---------- call lifecycle (authoritative state lives here) ----------


def start_call(*, caller, callee_id, call_id, mode, offer=None) -> Call | None:
    """Persist a ringing call. Idempotent on ``call_id`` for WS retries."""
    callee = User.objects.filter(pk=callee_id, is_active=True).first()
    if callee is None:
        return None
    conv = get_or_create_direct(caller, callee)
    call, _ = Call.objects.get_or_create(
        call_id=call_id,
        defaults={
            "conversation": conv,
            "caller": caller,
            "callee": callee,
            "mode": mode if mode in Call.Mode.values else Call.Mode.AUDIO,
            "offer": offer,
        },
    )
    return call


def sweep_ringing_for(user_id):
    """On (re)connect: finalize stale rings as MISSED and return the
    callee's still-fresh ringing calls so their invites can be replayed."""
    cutoff = timezone.now() - timezone.timedelta(seconds=RING_TIMEOUT_SECONDS)
    qs = Call.objects.filter(status=Call.Status.RINGING).filter(
        models.Q(caller_id=user_id) | models.Q(callee_id=user_id)
    ).select_related("caller__profile")
    fresh = []
    for call in qs:
        if call.created_at < cutoff:
            finalize_call(call, outcome=Call.Outcome.MISSED)
        elif call.callee_id == user_id:
            fresh.append(call)
    return fresh


def get_call(call_id) -> Call | None:
    return Call.objects.filter(call_id=call_id).first()


def caller_card(user) -> dict:
    """Server-built caller identity for the invite payload."""
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "first_name": getattr(profile, "first_name", "") or "",
        "last_name": getattr(profile, "last_name", "") or "",
        "job_title": getattr(profile, "job_title", "") or "",
    }


def answer_call(call_id) -> bool:
    """RINGING → ACTIVE. False when the call is unknown or already ended."""
    now = timezone.now()
    return bool(
        Call.objects.filter(call_id=call_id, status=Call.Status.RINGING).update(
            status=Call.Status.ACTIVE, answered_at=now, updated_at=now
        )
    )


def end_call(call_id, *, sender_id, event_type, reason=None) -> Message | None:
    """Finalize a call from a decline/end signal. Idempotent — returns
    None when the call is unknown, already ended, or the sender is not a
    participant (relayed payload still goes through either way)."""
    call = get_call(call_id)
    if call is None or sender_id not in (call.caller_id, call.callee_id):
        return None
    outcome = outcome_for_end(
        call, sender_id=sender_id, event_type=event_type, reason=reason
    )
    if outcome is None:
        return None
    return finalize_call(call, outcome=outcome)


def outcome_for_end(call, *, sender_id, event_type, reason=None):
    """Map a decline/end signal to the final outcome for this call."""
    if call.status == Call.Status.RINGING:
        if event_type == "call.decline":
            return (
                Call.Outcome.FAILED
                if reason in FAILURE_REASONS
                else Call.Outcome.DECLINED
            )
        # call.end while ringing: caller → cancelled, callee → declined.
        if reason in FAILURE_REASONS:
            return Call.Outcome.FAILED
        return (
            Call.Outcome.CANCELLED
            if sender_id == call.caller_id
            else Call.Outcome.DECLINED
        )
    if call.status == Call.Status.ACTIVE:
        return (
            Call.Outcome.FAILED
            if reason in FAILURE_REASONS
            else Call.Outcome.COMPLETED
        )
    return None


def finalize_call(call, *, outcome) -> Message | None:
    """End the call and append its single history event to the conversation.

    Idempotent: only the RINGING/ACTIVE → ENDED transition writes the
    message, so cancel-vs-timeout races cannot double-post.
    """
    now = timezone.now()
    with transaction.atomic():
        call = Call.objects.select_for_update().get(pk=call.pk)
        if call.status == Call.Status.ENDED:
            return None
        call.status = Call.Status.ENDED
        call.outcome = outcome
        call.ended_at = now
        call.offer = None
        if call.answered_at is not None:
            call.duration_seconds = max(
                0, int((now - call.answered_at).total_seconds())
            )
        call.save()
        msg = Message.objects.create(
            conversation=call.conversation,
            sender=call.caller,
            kind=Message.Kind.CALL,
            call=call,
        )
        conv = call.conversation
        conv.last_message_at = msg.created_at
        conv.save(update_fields=["last_message_at", "updated_at"])
        # The caller's own event never counts as unread for the caller.
        ConversationParticipant.objects.filter(
            conversation=conv, user=call.caller
        ).update(last_read_at=now)
    broadcast_message(msg)
    if outcome in (Call.Outcome.MISSED, Call.Outcome.CANCELLED):
        _notify_missed(call)
    return msg


def finalize_timeout(call_id) -> Call | None:
    """Server-side ring timeout. Returns the call only if WE ended it."""
    call = get_call(call_id)
    if call is None or call.status == Call.Status.ENDED:
        return None
    if finalize_call(call, outcome=Call.Outcome.MISSED) is None:
        return None
    return call


def _notify_missed(call):
    """Persistent notification for the callee's missed call."""
    from apps.notifications.models import Notification

    caller = call.caller
    profile = getattr(caller, "profile", None)
    name = (
        " ".join(p for p in (profile.first_name, profile.last_name) if p)
        if profile
        else ""
    ) or caller.email
    kind = "video" if call.mode == Call.Mode.VIDEO else "voice"
    Notification.objects.create(
        recipient=call.callee,
        item_type=Call.AUDIT_ITEM_TYPE,
        item_id=call.pk,
        message=f"Missed {kind} call from {name}"[:255],
    )


def record_failed_call(*, caller, callee, mode) -> Message:
    """Persist a call that never got off the ground (e.g. no mic/camera)."""
    conv = get_or_create_direct(caller, callee)
    with transaction.atomic():
        call = Call.objects.create(
            call_id=f"failed-{timezone.now().timestamp()}-{caller.pk}-{callee.pk}",
            conversation=conv,
            caller=caller,
            callee=callee,
            mode=mode if mode in Call.Mode.values else Call.Mode.AUDIO,
            status=Call.Status.ENDED,
            outcome=Call.Outcome.FAILED,
            ended_at=timezone.now(),
        )
        msg = Message.objects.create(
            conversation=conv,
            sender=caller,
            kind=Message.Kind.CALL,
            call=call,
        )
        conv.last_message_at = msg.created_at
        conv.save(update_fields=["last_message_at", "updated_at"])
        ConversationParticipant.objects.filter(
            conversation=conv, user=caller
        ).update(last_read_at=timezone.now())
    broadcast_message(msg)
    return msg
