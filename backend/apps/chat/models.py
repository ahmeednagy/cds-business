from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Conversation(TimeStampedModel):
    """A direct 1:1 conversation (group chat intentionally not modelled yet)."""

    class Kind(models.TextChoices):
        DIRECT = "direct", "Direct"

    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.DIRECT)
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="ConversationParticipant",
        related_name="conversations",
    )
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]


class ConversationParticipant(TimeStampedModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_memberships"
    )
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"], name="uniq_chat_participant"
            )
        ]


class Message(TimeStampedModel):
    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        CALL = "call", "Call event"

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    kind = models.CharField(
        max_length=8, choices=Kind.choices, default=Kind.TEXT
    )
    body = models.TextField(max_length=4000, blank=True, default="")
    call = models.OneToOneField(
        "Call",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="message",
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
        ]


class Call(TimeStampedModel):
    """One row per call attempt.

    Lifecycle: RINGING → (ACTIVE) → ENDED with a final ``outcome``.
    Finalization is idempotent — the first terminal transition wins, so
    races between a caller cancel and the server ring-timeout cannot
    produce duplicate history events (``message`` is OneToOne).
    """

    AUDIT_ITEM_TYPE = "call"

    class Mode(models.TextChoices):
        AUDIO = "audio", "Voice"
        VIDEO = "video", "Video"

    class Status(models.TextChoices):
        RINGING = "ringing", "Ringing"
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"

    class Outcome(models.TextChoices):
        COMPLETED = "completed", "Completed"
        MISSED = "missed", "Missed"
        CANCELLED = "cancelled", "Cancelled by caller"
        DECLINED = "declined", "Declined"
        FAILED = "failed", "Failed"

    call_id = models.CharField(max_length=64, unique=True)
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="calls"
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calls_made"
    )
    callee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calls_received",
    )
    mode = models.CharField(max_length=8, choices=Mode.choices)
    status = models.CharField(
        max_length=8, choices=Status.choices, default=Status.RINGING
    )
    outcome = models.CharField(
        max_length=16, choices=Outcome.choices, null=True, blank=True
    )
    # SDP offer is kept only while ringing so the invite can be replayed to
    # a callee that reconnects mid-ring; cleared on finalize.
    offer = models.JSONField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at", "-id"]
