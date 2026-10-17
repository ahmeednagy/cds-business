from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import TimeStampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    AUDIT_ITEM_TYPE = "user"

    class Role(models.TextChoices):
        EMPLOYEE = "EMPLOYEE", "Employee"
        MANAGER = "MANAGER", "Manager"
        HR = "HR", "HR"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EMPLOYEE)
    manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="direct_reports"
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def clean(self):
        # Prevent reporting-line cycles.
        seen, node = {self.pk}, self.manager
        while node is not None:
            if node.pk in seen:
                raise ValidationError({"manager": "Manager assignment would create a cycle."})
            seen.add(node.pk)
            node = node.manager

    def save(self, *args, **kwargs):
        self.full_clean(exclude=["password"])
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class EmployeeProfile(TimeStampedModel):
    """HR record attached to a user — editable vs HR-managed split (FR-010)."""

    EMPLOYEE_EDITABLE_FIELDS = ("phone", "address", "personal_email")

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    personal_email = models.EmailField(blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    hire_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Profile({self.user.email})"
