from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class AttendanceSession(TimeStampedModel):
    """One check-in → check-out interval. The database is the source of truth:
    timestamps are always taken server-side (timezone.now()), never from the
    client. At most one open (check_out_at IS NULL) session per employee is
    enforced by a partial unique constraint."""

    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="attendance_sessions",
    )
    work_date = models.DateField()
    check_in_at = models.DateTimeField()
    check_out_at = models.DateTimeField(null=True, blank=True)
    worked_duration = models.DurationField(null=True, blank=True)

    class Meta:
        ordering = ["-check_in_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["submitter"],
                condition=Q(check_out_at__isnull=True),
                name="unique_open_attendance_per_user",
            )
        ]
        indexes = [
            models.Index(fields=["submitter", "work_date"]),
            models.Index(fields=["work_date"]),
        ]

    @property
    def is_open(self) -> bool:
        return self.check_out_at is None
