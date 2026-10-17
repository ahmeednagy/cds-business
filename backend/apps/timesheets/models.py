from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import TimeStampedModel


class Timesheet(TimeStampedModel):
    """Weekly timesheet — one per employee per week (FR-025). `submitter` is the
    employee; the shared workflow engine addresses it through that name."""

    AUDIT_ITEM_TYPE = "timesheet"

    STATUS_CHOICES = [
        (s, s.title().replace("_", " "))
        for s in ("PENDING", "IN_REVIEW", "RETURNED", "APPROVED", "REJECTED", "WITHDRAWN")
    ]

    submitter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="timesheets"
    )
    week_start = models.DateField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    current_step = models.PositiveSmallIntegerField(default=0)
    workflow_snapshot = models.JSONField(default=list)
    current_actor_role = models.CharField(max_length=8, blank=True)
    requires_hr_review = models.BooleanField(default=False)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-week_start", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["submitter", "week_start"], name="unique_timesheet_per_week"
            )
        ]
        indexes = [
            models.Index(fields=["status", "current_actor_role"]),
            models.Index(fields=["submitter", "status"]),
            models.Index(fields=["week_start"]),
        ]

    def clean(self):
        if self.week_start and self.week_start.weekday() != 0:
            raise ValidationError({"week_start": "Week start must be a Monday."})


class TimesheetEntry(models.Model):
    timesheet = models.ForeignKey(
        Timesheet, on_delete=models.CASCADE, related_name="entries"
    )
    date = models.DateField()
    hours = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(24)],
    )

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["timesheet", "date"], name="unique_entry_per_day"
            )
        ]

    def clean(self):
        if self.timesheet_id and self.date:
            start = self.timesheet.week_start
            if not (start <= self.date <= start + timedelta(days=6)):
                raise ValidationError({"date": "Entry date must fall inside the week."})
