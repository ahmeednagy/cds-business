from rest_framework import serializers

from .models import AttendanceSession


class AttendanceSessionSerializer(serializers.ModelSerializer):
    submitter_email = serializers.EmailField(source="submitter.email", read_only=True)
    worked_seconds = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "submitter",
            "submitter_email",
            "work_date",
            "check_in_at",
            "check_out_at",
            "worked_seconds",
        ]

    def get_worked_seconds(self, obj) -> int | None:
        if obj.worked_duration is None:
            return None
        return int(obj.worked_duration.total_seconds())
