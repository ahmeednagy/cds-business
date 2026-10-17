from rest_framework import serializers

from .models import AuditEntry


class AuditEntrySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = AuditEntry
        fields = [
            "id",
            "actor",
            "actor_email",
            "action",
            "from_status",
            "to_status",
            "comment",
            "created_at",
        ]
