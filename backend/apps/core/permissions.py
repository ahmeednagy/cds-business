from django.db.models import Q
from rest_framework.permissions import SAFE_METHODS, BasePermission

# Paths usable while must_change_password is set (everything else is gated).
_PASSWORD_CHANGE_ALLOWED_PREFIXES = ("/api/auth/", "/api/me")


class IsAuthenticatedAndPasswordFresh(BasePermission):
    """Authenticated + must_change_password gate (FR-005/FR-007)."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.must_change_password and not request.path.startswith(
            _PASSWORD_CHANGE_ALLOWED_PREFIXES
        ):
            return False
        return True


class IsHR(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "HR")


class IsManagerOrHR(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("MANAGER", "HR")
        )


class IsOwnerOrHR(BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        return user.role == "HR" or obj == user or getattr(obj, "user", None) == user


def scope_items(user, qs):
    """Scope a request/timesheet queryset to what the user may see (FR-006).

    EMPLOYEE → own items; MANAGER → own + direct reports (live reporting line, FR-018);
    HR → own items + items whose workflow includes an HR step (least privilege, FR-019).
    """
    if user.role == "HR":
        return qs.filter(Q(submitter=user) | Q(requires_hr_review=True))
    if user.role == "MANAGER":
        return qs.filter(Q(submitter=user) | Q(submitter__manager=user))
    return qs.filter(submitter=user)


def queue_items(user, qs):
    """Items currently awaiting the user's review action."""
    if user.role == "MANAGER":
        return qs.filter(
            submitter__manager=user,
            current_actor_role="MANAGER",
            status__in=("PENDING", "IN_REVIEW"),
        )
    if user.role == "HR":
        return qs.filter(current_actor_role="HR", status__in=("PENDING", "IN_REVIEW"))
    return qs.none()


class IsSafeOrScoped:
    """Marker mixin documented for views that rely on scoped querysets for object access."""
