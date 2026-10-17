import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditEntry
from apps.audit.serializers import AuditEntrySerializer
from apps.core.exceptions import Conflict
from apps.core.permissions import IsHR, scope_items
from apps.workflows import services as wf

from .filters import RequestFilter
from .models import Attachment, Request, RequestType
from .serializers import (
    RequestCreateSerializer,
    RequestDetailSerializer,
    RequestListSerializer,
    RequestSubmitSerializer,
    RequestTypeSerializer,
    ReviewActionSerializer,
)
from .services import resubmit_request, submit_request


def _review(viewset, request, pk, action_name):
    item = get_object_or_404(viewset.get_queryset(), pk=pk)
    if not wf.is_current_actor(item, request.user):
        raise PermissionDenied("You are not the current reviewer for this item.")
    serializer = ReviewActionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    wf.act(item, request.user, action_name, comment=serializer.validated_data["comment"])
    return Response({"id": item.pk, "status": item.status})


class RequestTypeViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    serializer_class = RequestTypeSerializer

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update"):
            return [IsAuthenticated(), IsHR()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = RequestType.objects.select_related("workflow").prefetch_related(
            "workflow__steps"
        )
        if self.request.user.role != "HR":
            qs = qs.filter(is_active=True)
        return qs.order_by("name")

    def perform_create(self, serializer):
        from apps.audit.services import record as audit_record

        request_type = serializer.save()
        audit_record(request_type, self.request.user, action="request_type_create",
                     comment=f"Request type '{request_type.name}' created")

    def perform_update(self, serializer):
        from apps.audit.services import record as audit_record

        request_type = serializer.save()
        audit_record(request_type, self.request.user, action="request_type_update",
                     comment=f"Request type '{request_type.name}' updated")


class RequestViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "head", "options"]
    filterset_class = RequestFilter
    ordering_fields = [
        "submitted_at",
        "status",
        "request_type__name",
        "submitter__email",
        "current_actor_role",
    ]

    def get_queryset(self):
        qs = Request.objects.select_related("request_type", "submitter").prefetch_related(
            "attachments"
        )
        return scope_items(self.request.user, qs)

    def get_serializer_class(self):
        if self.action == "create":
            return RequestCreateSerializer
        if self.action == "submit":
            return RequestSubmitSerializer
        if self.action == "list":
            return RequestListSerializer
        return RequestDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = submit_request(
            request.user,
            serializer.validated_data["request_type"],
            serializer.validated_data["values"],
            serializer.validated_data.get("comment", ""),
        )
        return Response(
            RequestDetailSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def list(self, request, *args, **kwargs):
        # Reviewer listing: reviewer email for non-owner-visible items is still
        # in-scope here since the queryset is already role-scoped.
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        item = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resubmit_request(
            item, request.user,
            values=serializer.validated_data.get("values"),
            comment=serializer.validated_data.get("comment", ""),
        )
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
        entries = AuditEntry.objects.filter(item_type="request", item_id=item.pk)
        return Response({"results": AuditEntrySerializer(entries, many=True).data})


class AttachmentViewSet(viewsets.GenericViewSet):
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Attachment.objects.select_related("request", "request__submitter")

    def _parent_request(self, attachment):
        return attachment.request

    def _authorized_view(self, request, attachment):
        scoped = scope_items(request.user, Request.objects.filter(pk=attachment.request_id))
        if not scoped.exists() or attachment.removed_at is not None:
            raise NotFound()

    def create(self, request):
        request_id = request.data.get("request")
        parent = get_object_or_404(
            scope_items(request.user, Request.objects.all()), pk=request_id
        )
        if parent.submitter_id != request.user.pk:
            raise PermissionDenied("Only the owner can attach files.")
        if not parent.request_type.allow_attachments:
            raise ValidationError("This request type does not allow attachments.")
        if not wf.is_editable(parent):
            raise Conflict("Attachments can only be changed while the request is editable.")

        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "A file is required."})
        if upload.size > settings.ATTACHMENT_MAX_BYTES:
            raise ValidationError({"file": "File exceeds the 10 MB limit."})
        ext = Path(upload.name).suffix.lower()
        if ext not in settings.ATTACHMENT_ALLOWED_EXTENSIONS:
            raise ValidationError({"file": "File type is not allowed."})
        attachment = Attachment.objects.create(
            request=parent,
            file=upload,
            original_name=upload.name[:255],
            content_type=upload.content_type
            or mimetypes.guess_type(upload.name)[0]
            or "application/octet-stream",
            size=upload.size,
            uploaded_by=request.user,
        )
        return Response(
            {"id": attachment.pk, "original_name": attachment.original_name},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        attachment = get_object_or_404(self.get_queryset(), pk=pk)
        self._authorized_view(request, attachment)
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_name,
            content_type=attachment.content_type,
        )

    def destroy(self, request, pk=None):
        attachment = get_object_or_404(self.get_queryset(), pk=pk)
        if attachment.request.submitter_id != request.user.pk:
            raise NotFound()  # mask existence (FR-029)
        if attachment.removed_at is not None:
            raise NotFound()
        if not wf.is_editable(attachment.request):
            raise Conflict("Attachments can only be removed while the request is editable.")
        attachment.removed_at = timezone.now()
        attachment.save(update_fields=["removed_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
