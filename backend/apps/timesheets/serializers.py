from datetime import timedelta

from rest_framework import serializers

from apps.attendance.models import AttendanceSession
from apps.attendance.serializers import AttendanceSessionSerializer
from apps.workflows import services as wf

from .models import Timesheet, TimesheetEntry


class TimesheetEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimesheetEntry
        fields = ["date", "hours"]


class TimesheetListSerializer(serializers.ModelSerializer):
    submitter_email = serializers.EmailField(source="submitter.email", read_only=True)
    total_hours = serializers.SerializerMethodField()

    class Meta:
        model = Timesheet
        fields = [
            "id",
            "submitter",
            "submitter_email",
            "week_start",
            "status",
            "current_actor_role",
            "total_hours",
            "submitted_at",
        ]

    def get_total_hours(self, obj):
        return float(sum(e.hours for e in obj.entries.all()))


class TimesheetDetailSerializer(TimesheetListSerializer):
    entries = TimesheetEntrySerializer(many=True, read_only=True)
    actions = serializers.SerializerMethodField()
    attendance = serializers.SerializerMethodField()
    attendance_hours = serializers.SerializerMethodField()
    days = serializers.SerializerMethodField()

    class Meta(TimesheetListSerializer.Meta):
        fields = TimesheetListSerializer.Meta.fields + [
            "entries",
            "attendance",
            "attendance_hours",
            "days",
            "actions",
            "current_step",
            "workflow_snapshot",
            "created_at",
            "updated_at",
        ]

    def get_days(self, obj):
        """Deterministic per-day view: AttendanceSession(submitter, work_date)
        → the matching day of this timesheet's week. All 7 days are emitted so
        days with attendance but no manual entry still surface."""
        by_date = {}
        for s in self._attendance_sessions(obj):
            by_date.setdefault(s.work_date, []).append(s)
        manual = {e.date: e.hours for e in obj.entries.all()}
        rows = []
        for i in range(7):
            date = obj.week_start + timedelta(days=i)
            sessions = by_date.get(date, [])
            worked = sum(
                s.worked_duration.total_seconds()
                for s in sessions
                if s.worked_duration is not None
            )
            rows.append(
                {
                    "date": date,
                    "check_in_at": (
                        min(s.check_in_at for s in sessions) if sessions else None
                    ),
                    "check_out_at": (
                        max(s.check_out_at for s in sessions)
                        if sessions and all(s.check_out_at for s in sessions)
                        else None
                    ),
                    "has_open": any(s.check_out_at is None for s in sessions),
                    "worked_seconds": int(worked),
                    "manual_hours": (
                        float(manual[date]) if date in manual else None
                    ),
                }
            )
        return rows

    def _attendance_sessions(self, obj):
        if not hasattr(obj, "_attendance_sessions_cache"):
            obj._attendance_sessions_cache = list(
                AttendanceSession.objects.filter(
                    submitter=obj.submitter,
                    work_date__gte=obj.week_start,
                    work_date__lte=obj.week_start + timedelta(days=6),
                ).order_by("work_date", "check_in_at")
            )
        return obj._attendance_sessions_cache

    def get_attendance(self, obj):
        return AttendanceSessionSerializer(
            self._attendance_sessions(obj), many=True, context=self.context
        ).data

    def get_attendance_hours(self, obj):
        seconds = sum(
            s.worked_duration.total_seconds()
            for s in self._attendance_sessions(obj)
            if s.worked_duration is not None
        )
        return round(seconds / 3600, 2)

    def get_actions(self, obj):
        return wf.available_actions(obj, self.context["request"].user)


class TimesheetCreateSerializer(serializers.Serializer):
    week_start = serializers.DateField()
    entries = TimesheetEntrySerializer(many=True)

    def validate_week_start(self, value):
        if value.weekday() != 0:
            raise serializers.ValidationError("Week start must be a Monday.")
        return value

    def validate_entries(self, entries):
        if not entries:
            raise serializers.ValidationError("At least one daily entry is required.")
        dates = [e["date"] for e in entries]
        if len(dates) != len(set(dates)):
            raise serializers.ValidationError("Duplicate entry dates.")
        for entry in entries:
            if entry["hours"] <= 0:
                raise serializers.ValidationError("Hours must be greater than zero.")
        return entries

    def validate(self, attrs):
        start = attrs["week_start"]
        end = start + timedelta(days=6)
        for entry in attrs["entries"]:
            if not (start <= entry["date"] <= end):
                raise serializers.ValidationError(
                    {"entries": "All entry dates must fall inside the week."}
                )
        return attrs


class ReviewCommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")
