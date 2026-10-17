from rest_framework import serializers

from apps.accounts.models import User

from .models import Call, Conversation, Message


class ChatUserSerializer(serializers.ModelSerializer):
    """Minimal public card for chat — names/titles only, no HR fields."""

    first_name = serializers.CharField(source="profile.first_name", read_only=True)
    last_name = serializers.CharField(source="profile.last_name", read_only=True)
    job_title = serializers.CharField(source="profile.job_title", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "role", "first_name", "last_name", "job_title"]


class CallInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Call
        fields = ["call_id", "mode", "outcome", "duration_seconds"]


class MessageSerializer(serializers.ModelSerializer):
    call = CallInfoSerializer(read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "kind",
            "body",
            "call",
            "created_at",
        ]
        read_only_fields = ["conversation", "sender"]


class ConversationSerializer(serializers.ModelSerializer):
    peer = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "kind",
            "peer",
            "last_message",
            "last_message_at",
            "unread_count",
        ]

    def _my_membership(self, obj):
        return obj.memberships.get(user=self.context["request"].user)

    def get_peer(self, obj):
        peer = obj.memberships.exclude(
            user=self.context["request"].user
        ).select_related("user__profile").first()
        return ChatUserSerializer(peer.user).data if peer else None

    def get_last_message(self, obj):
        msg = obj.messages.first()
        return MessageSerializer(msg).data if msg else None

    def get_unread_count(self, obj):
        membership = self._my_membership(obj)
        qs = obj.messages.exclude(sender=self.context["request"].user)
        if membership.last_read_at is not None:
            qs = qs.filter(created_at__gt=membership.last_read_at)
        return qs.count()


class DirectConversationCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        request = self.context["request"]
        if value == request.user.id:
            raise serializers.ValidationError("Cannot message yourself.")
        try:
            other = User.objects.get(pk=value, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.") from None
        self.context["other"] = other
        return value
