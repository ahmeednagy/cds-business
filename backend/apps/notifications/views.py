from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        params = self.request.query_params
        if params.get("unread") == "true":
            qs = qs.filter(read_at__isnull=True)
        elif params.get("read") == "true":
            qs = qs.filter(read_at__isnull=False)
        if params.get("item_type"):
            qs = qs.filter(item_type=params["item_type"])
        if params.get("search"):
            qs = qs.filter(message__icontains=params["search"])
        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        marked = self.get_queryset().filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"marked": marked})
