from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import Conflict

from .models import AttendanceSession
from .serializers import AttendanceSessionSerializer


def scope_attendance(user, qs):
    """Attendance visibility — mirrors scope_items' role model:
    EMPLOYEE → own; MANAGER → own + direct reports; HR → all (HR administers
    attendance for the organisation; there is no per-item workflow gate)."""
    if user.role == "HR":
        return qs
    if user.role == "MANAGER":
        return qs.filter(Q(submitter=user) | Q(submitter__manager=user))
    return qs.filter(submitter=user)


def _serialize(request, obj):
    return AttendanceSessionSerializer(obj, context={"request": request}).data


class CheckInView(APIView):
    """POST /api/attendance/check-in/ — open a session at server time."""

    def post(self, request):
        session = AttendanceSession(
            submitter=request.user,
            work_date=timezone.localdate(),
            check_in_at=timezone.now(),
        )
        try:
            with transaction.atomic():
                session.save()
        except IntegrityError:
            raise Conflict("You are already checked in.")
        return Response(_serialize(request, session), status=status.HTTP_201_CREATED)


class CheckOutView(APIView):
    """POST /api/attendance/check-out/ — close the open session at server time."""

    def post(self, request):
        session = (
            AttendanceSession.objects.filter(submitter=request.user, check_out_at__isnull=True)
            .order_by("-check_in_at")
            .first()
        )
        if session is None:
            raise Conflict("No active check-in session.")
        now = timezone.now()
        session.check_out_at = now
        session.worked_duration = now - session.check_in_at
        session.save(update_fields=["check_out_at", "worked_duration", "updated_at"])
        return Response(_serialize(request, session))


class TodayView(APIView):
    """GET /api/attendance/today/ — active session + all of today's sessions."""

    def get(self, request):
        today = timezone.localdate()
        sessions = AttendanceSession.objects.filter(
            submitter=request.user, work_date=today
        )
        data = AttendanceSessionSerializer(
            sessions, many=True, context={"request": request}
        ).data
        active = next((s for s in data if s["check_out_at"] is None), None)
        return Response({"active": active, "sessions": data})


class WeekView(APIView):
    """GET /api/attendance/week/?start=YYYY-MM-DD — scoped sessions for the
    Monday-anchored week containing `start` (defaults to the current week)."""

    def get(self, request):
        start_param = request.query_params.get("start")
        if start_param:
            try:
                start = serializers.DateField().to_internal_value(start_param)
            except serializers.ValidationError:
                raise serializers.ValidationError(
                    {"start": "Invalid date — expected YYYY-MM-DD."}
                )
        else:
            start = timezone.localdate()
        # Normalize to the week's Monday, matching the timesheet week model.
        week_start = start - timedelta(days=start.weekday())
        week_end = week_start + timedelta(days=6)
        qs = scope_attendance(
            request.user,
            AttendanceSession.objects.filter(
                work_date__gte=week_start, work_date__lte=week_end
            ).select_related("submitter"),
        ).order_by("work_date", "check_in_at")
        return Response(
            {
                "week_start": week_start,
                "week_end": week_end,
                "results": AttendanceSessionSerializer(
                    qs, many=True, context={"request": request}
                ).data,
            }
        )
