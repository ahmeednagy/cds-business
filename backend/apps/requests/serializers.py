from rest_framework import serializers

from apps.workflows import services as wf

from .models import Attachment, Request, RequestType


class RequestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestType
        fields = [
            "id",
            "name",
            "workflow",
            "fields_schema",
            "allow_attachments",
            "require_attachments",
            "is_active",
            "created_at",
            "updated_at",
        ]


class AttachmentMetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "original_name", "content_type", "size", "created_at"]


class RequestListSerializer(serializers.ModelSerializer):
    request_type_name = serializers.CharField(source="request_type.name", read_only=True)
    submitter_email = serializers.EmailField(source="submitter.email", read_only=True)

    class Meta:
        model = Request
        fields = [
            "id",
            "request_type",
            "request_type_name",
            "submitter",
            "submitter_email",
            "status",
            "current_actor_role",
            "submitted_at",
        ]


class RequestDetailSerializer(serializers.ModelSerializer):
    request_type_name = serializers.CharField(source="request_type.name", read_only=True)
    submitter_email = serializers.EmailField(source="submitter.email", read_only=True)
    attachments = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    class Meta:
        model = Request
        fields = RequestListSerializer.Meta.fields + [
            "values",
            "comment",
            "current_step",
            "workflow_snapshot",
            "attachments",
            "actions",
            "created_at",
            "updated_at",
        ]

    def get_attachments(self, obj):
        files = obj.attachments.filter(removed_at__isnull=True)
        return AttachmentMetaSerializer(files, many=True).data

    def get_actions(self, obj):
        return wf.available_actions(obj, self.context["request"].user)


class RequestCreateSerializer(serializers.Serializer):
    request_type = serializers.PrimaryKeyRelatedField(
        queryset=RequestType.objects.filter(is_active=True)
    )
    values = serializers.JSONField(default=dict)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class RequestSubmitSerializer(serializers.Serializer):
    """Resubmission of a RETURNED request — optional corrected values + comment."""

    values = serializers.JSONField(required=False)
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class ReviewActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")
