from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import EmployeeProfile, User


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class ProfileSerializer(serializers.ModelSerializer):
    editable_fields = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = [
            "first_name",
            "last_name",
            "phone",
            "address",
            "personal_email",
            "job_title",
            "department",
            "hire_date",
            "editable_fields",
        ]

    def get_editable_fields(self, obj):
        return list(EmployeeProfile.EMPLOYEE_EDITABLE_FIELDS)


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "role", "must_change_password", "manager", "profile"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Employee self-update — whitelists employee-editable fields only (FR-010)."""

    class Meta:
        model = EmployeeProfile
        fields = list(EmployeeProfile.EMPLOYEE_EDITABLE_FIELDS)


class EmployeeCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.EMPLOYEE)
    manager = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), required=False, allow_null=True
    )
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    job_title = serializers.CharField(max_length=120, required=False, allow_blank=True)
    department = serializers.CharField(max_length=120, required=False, allow_blank=True)
    hire_date = serializers.DateField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class EmployeeUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    manager = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), required=False, allow_null=True
    )
    is_active = serializers.BooleanField(required=False)
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    job_title = serializers.CharField(max_length=120, required=False)
    department = serializers.CharField(max_length=120, required=False)
    hire_date = serializers.DateField(required=False, allow_null=True)


class EmployeeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    manager_email = serializers.EmailField(source="manager.email", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "manager",
            "manager_email",
            "is_active",
            "must_change_password",
            "profile",
            "created_at",
        ]


class TeamMemberSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    pending_items = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = ["id", "email", "role", "profile", "pending_items"]
