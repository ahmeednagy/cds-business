from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class RequestType(TimeStampedModel):
    """HR-configured request template (FR-011/FR-012)."""

    AUDIT_ITEM_TYPE = "request_type"

    name = models.CharField(max_length=120, unique=True)
    workflow = models.ForeignKey(
        "workflows.Workflow", on_delete=models.PROTECT, related_name="request_types"
    )
    # [{key, label, type: text|number|date|choice, required, choices?}]
    fields_schema = models.JSONField(default=list, blank=True)
    allow_attachments = models.BooleanField(default=True)
    require_attachments = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Request(TimeStampedModel):
    AUDIT_ITEM_TYPE = "request"

    STATUS_CHOICES = [
        (s, s.title().replace("_", " "))
        for s in ("PENDING", "IN_REVIEW", "RETURNED", "APPROVED", "REJECTED", "WITHDRAWN")
    ]

    request_type = models.ForeignKey(
        RequestType, on_delete=models.PROTECT, related_name="requests"
    )
    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requests"
    )
    values = models.JSONField(default=dict)
    comment = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    current_step = models.PositiveSmallIntegerField(default=0)
    workflow_snapshot = models.JSONField(default=list)
    current_actor_role = models.CharField(max_length=8, blank=True)
    requires_hr_review = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at", "-id"]
        indexes = [
            models.Index(fields=["status", "current_actor_role"]),
            models.Index(fields=["submitter", "status"]),
            models.Index(fields=["submitted_at"]),
        ]

    def __str__(self):
        return f"Request#{self.pk} ({self.request_type})"


class Attachment(TimeStampedModel):
    """Request-scoped private file — soft-deleted via removed_at (FR-031, FR-045)."""

    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/%Y/%m/")
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    removed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.original_name
