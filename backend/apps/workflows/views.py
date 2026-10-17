from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.audit.services import record as audit_record
from apps.core.permissions import IsHR

from .models import Workflow
from .serializers import WorkflowSerializer, WorkflowWriteSerializer


class WorkflowViewSet(viewsets.ModelViewSet):
    """Workflow administration — HR-managed (FR-019). Reads are authenticated."""

    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update", "destroy"):
            return [IsAuthenticated(), IsHR()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Workflow.objects.prefetch_related("steps").order_by("id")

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return WorkflowWriteSerializer
        return WorkflowSerializer

    def perform_create(self, serializer):
        workflow = serializer.save()
        audit_record(workflow, self.request.user, action="workflow_create",
                     comment=f"Workflow '{workflow.name}' created")

    def perform_update(self, serializer):
        workflow = serializer.save()
        audit_record(workflow, self.request.user, action="workflow_update",
                     comment=f"Workflow '{workflow.name}' updated")
