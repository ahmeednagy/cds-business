from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .models import Call, Conversation, Message
from .serializers import (
    ChatUserSerializer,
    ConversationSerializer,
    DirectConversationCreateSerializer,
    MessageSerializer,
)
from .services import (
    broadcast_read,
    get_or_create_direct,
    post_message,
    record_failed_call,
)


class ConversationViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(
            memberships__user=self.request.user
        ).prefetch_related("memberships__user__profile")

    def list(self, request, *args, **kwargs):
        # The Chats list only shows conversations with real activity —
        # never pre-created/empty shells, so it is not an employee directory.
        qs = (
            self.get_queryset()
            .filter(messages__isnull=False)
            .distinct()
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )
        return Response(self.get_serializer(qs, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = DirectConversationCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        conv = get_or_create_direct(request.user, serializer.context["other"])
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        conv = self.get_object()
        qs = conv.messages.select_related("sender")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(MessageSerializer(page, many=True).data)

    @messages.mapping.post
    def send_message(self, request, pk=None):
        conv = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response(
                {"error": {"code": "validation", "message": "Message body is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        msg = post_message(conv, request.user, body[:4000])
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conv = self.get_object()
        membership = conv.memberships.get(user=request.user)
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_at", "updated_at"])
        broadcast_read(conv, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatUnreadView(APIView):
    def get(self, request):
        total = 0
        memberships = request.user.chat_memberships.select_related("conversation")
        for m in memberships:
            qs = Message.objects.filter(conversation=m.conversation).exclude(
                sender=request.user
            )
            if m.last_read_at is not None:
                qs = qs.filter(created_at__gt=m.last_read_at)
            total += qs.count()
        return Response({"count": total})


class ContactViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    """Directory of messagable colleagues — active users only, minimal fields."""

    serializer_class = ChatUserSerializer

    def get_queryset(self):
        qs = (
            User.objects.filter(is_active=True)
            .exclude(pk=self.request.user.pk)
            .select_related("profile")
            .order_by("profile__first_name", "profile__last_name", "email")
        )
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(profile__first_name__icontains=search)
                | Q(profile__last_name__icontains=search)
                | Q(profile__job_title__icontains=search)
                | Q(email__icontains=search)
            )
        return qs


class FailedCallView(APIView):
    """Record a call attempt that never reached signalling — e.g. the
    caller's mic/camera was unavailable before the invite was sent."""

    def post(self, request):
        try:
            callee = User.objects.get(
                pk=int(request.data.get("user_id")), is_active=True
            )
        except (TypeError, ValueError, User.DoesNotExist):
            return Response(
                {"error": {"code": "validation", "message": "User not found."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if callee.pk == request.user.pk:
            return Response(
                {"error": {"code": "validation", "message": "Cannot call yourself."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mode = request.data.get("mode")
        msg = record_failed_call(
            caller=request.user,
            callee=callee,
            mode=mode if mode in Call.Mode.values else Call.Mode.AUDIO,
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class PresenceView(APIView):
    """Real presence: who has an open chat WebSocket in this process."""

    def get(self, request):
        from .consumers import online_user_ids

        raw = request.query_params.get("ids", "")
        ids = [int(i) for i in raw.split(",") if i.strip().isdigit()]
        online = online_user_ids()
        return Response({"online": [i for i in ids if i in online]})
