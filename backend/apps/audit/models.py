from django.conf import settings
from django.db import models


class AuditEntry(models.Model):
    """Append-only audit record (FR-035–FR-037). No update/delete paths exist."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="audit_entries"
    )
    action = models.CharField(max_length=32)
    item_type = models.CharField(max_length=32)
    item_id = models.PositiveBigIntegerField()
    from_status = models.CharField(max_length=16, null=True, blank=True)
    to_status = models.CharField(max_length=16, null=True, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["item_type", "item_id"])]

    def __str__(self):
        return f"{self.action} on {self.item_type}#{self.item_id} by {self.actor_id}"
