from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.audit.models import AuditEntry
from apps.audit.serializers import AuditEntrySerializer
from apps.audit.services import record as audit_record
from apps.core.exceptions import Conflict
from apps.core.permissions import scope_items
from apps.notifications.services import emit
from apps.workflows import services as wf

from .filters import TimesheetFilter
from .models import Timesheet, TimesheetEntry
from .serializers import (
    ReviewCommentSerializer,
    TimesheetCreateSerializer,
    TimesheetDetailSerializer,
    TimesheetListSerializer,
)


def _review(viewset, request, pk, action_name):
    item = get_object_or_404(viewset.get_queryset(), pk=pk)
    if not wf.is_current_actor(item, request.user):
        raise PermissionDenied("You are not the current reviewer for this item.")
    serializer = ReviewCommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    wf.act(item, request.user, action_name, comment=serializer.validated_data["comment"])
    return Response({"id": item.pk, "status": item.status})


class TimesheetViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    filterset_class = TimesheetFilter
    ordering_fields = ["week_start", "status", "submitted_at"]

    def get_queryset(self):
        qs = Timesheet.objects.select_related("submitter").prefetch_related("entries")
        return scope_items(self.request.user, qs)

    def get_serializer_class(self):
        if self.action in ("create", "submit"):
            return TimesheetCreateSerializer
        if self.action == "list":
            return TimesheetListSerializer
        return TimesheetDetailSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workflow = wf.default_workflow()
        steps = workflow.snapshot_steps()
        item = Timesheet(
            submitter=request.user,
            week_start=serializer.validated_data["week_start"],
            workflow_snapshot=steps,
            current_step=0,
            current_actor_role=steps[0]["actor_role"],
            requires_hr_review=any(s["actor_role"] == "HR" for s in steps),
        )
        try:
            item.save()
        except IntegrityError:
            raise Conflict("A timesheet for this week already exists.")
        TimesheetEntry.objects.bulk_create(
            [
                TimesheetEntry(timesheet=item, **entry)
                for entry in serializer.validated_data["entries"]
            ]
        )
        audit_record(item, request.user, action="submit", to_status=item.status)
        step = wf.current_step(item)
        if step:
            emit(
                wf.step_actors(item, step), item,
                "A timesheet is awaiting your review.", actor=request.user,
            )
        return Response(
            TimesheetDetailSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Resubmit a RETURNED timesheet, optionally with corrected entries."""
        item = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        entries = serializer.validated_data.get("entries")
        if entries is not None:
            with transaction.atomic():
                item.entries.all().delete()
                TimesheetEntry.objects.bulk_create(
                    [TimesheetEntry(timesheet=item, **e) for e in entries]
                )
        wf.act(item, request.user, "submit")
        return Response({"id": item.pk, "status": item.status})

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        item = self.get_object()
        wf.act(item, request.user, "withdraw", comment=request.data.get("comment", ""))
        return Response({"id": item.pk, "status": item.status})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return _review(self, request, pk, "approve")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return _review(self, request, pk, "reject")

    @action(detail=True, methods=["post"], url_path="return")
    def send_back(self, request, pk=None):
        return _review(self, request, pk, "return")

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        item = self.get_object()
        entries = AuditEntry.objects.filter(item_type="timesheet", item_id=item.pk)
        return Response({"results": AuditEntrySerializer(entries, many=True).data})
