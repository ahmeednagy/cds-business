from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import queue_items
from apps.notifications.models import Notification


class DashboardView(APIView):
    """Role-shaped dashboard aggregates (FR-040)."""

    def get(self, request):
        from apps.accounts.models import User
        from apps.requests.models import Request
        from apps.timesheets.models import Timesheet

        user = request.user
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())

        week_sheet = (
            Timesheet.objects.filter(submitter=user, week_start=week_start)
            .values("status")
            .first()
        )
        data = {
            "open_requests": Request.objects.filter(
                submitter=user, status__in=("PENDING", "IN_REVIEW", "RETURNED")
            ).count(),
            "current_timesheet_status": week_sheet["status"] if week_sheet else None,
            "unread_notifications": Notification.objects.filter(
                recipient=user, read_at__isnull=True
            ).count(),
        }
        if user.role == "MANAGER":
            data["pending_reviews"] = queue_items(user, Request.objects.all()).count() + (
                queue_items(user, Timesheet.objects.all()).count()
            )
            data["team_size"] = User.objects.filter(manager=user, is_active=True).count()
        if user.role == "HR":
            data["pending_reviews"] = queue_items(user, Request.objects.all()).count() + (
                queue_items(user, Timesheet.objects.all()).count()
            )
            data["active_employees"] = User.objects.filter(is_active=True).count()
            data["requests_by_status"] = {
                row["status"]: row["n"]
                for row in Request.objects.values("status").annotate(n=Count("id"))
            }
            data["timesheets_by_status"] = {
                row["status"]: row["n"]
                for row in Timesheet.objects.values("status").annotate(n=Count("id"))
            }
        return Response(data)
