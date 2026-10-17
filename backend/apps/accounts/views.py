import secrets

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, Q
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import record as audit_record
from apps.core.permissions import IsHR, queue_items

from .models import EmployeeProfile, User
from .serializers import (
    ChangePasswordSerializer,
    EmployeeCreateSerializer,
    EmployeeSerializer,
    EmployeeUpdateSerializer,
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    TeamMemberSerializer,
)


def _set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        **settings.REFRESH_COOKIE_KWARGS,
    )
    return response


def _cookie_refresh(request):
    raw = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
    if not raw:
        return None
    try:
        return RefreshToken(raw)
    except TokenError:
        return None


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = request.data.get("email", "")
        password = request.data.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            # Generic failure — never disclose which part failed (FR-004).
            return Response(
                {"error": {"code": "unauthenticated", "message": "Invalid credentials."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        refresh = RefreshToken.for_user(user)
        response = Response({"access": str(refresh.access_token)})
        return _set_refresh_cookie(response, refresh)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh = _cookie_refresh(request)
        if refresh is None:
            return Response(
                {"error": {"code": "unauthenticated", "message": "Session expired."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh.check_exp()
            user = User.objects.get(pk=refresh["user_id"])
            if not user.is_active:
                raise TokenError("Account deactivated")
            # Rotation: blacklist the used token and issue a fresh pair.
            refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
        except (TokenError, User.DoesNotExist):
            response = Response(
                {"error": {"code": "unauthenticated", "message": "Session expired."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            response.delete_cookie(
                settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_KWARGS["path"]
            )
            return response
        response = Response({"access": str(new_refresh.access_token)})
        return _set_refresh_cookie(response, new_refresh)


class LogoutView(APIView):
    def post(self, request):
        refresh = _cookie_refresh(request)
        if refresh is not None:
            try:
                refresh.blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_KWARGS["path"]
        )
        return response


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        if user.must_change_password:
            user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        audit_record(user, user, action="password_change", comment="Password changed")
        return Response(status=status.HTTP_204_NO_CONTENT)


def _user_from_uidb64(uidb64):
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        return User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def _invalid_token_response():
    return Response(
        {
            "error": {
                "code": "invalid_token",
                "message": "This reset link is invalid or has expired.",
            }
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def _token_valid(user, token):
    return (
        user is not None
        and user.is_active
        and default_token_generator.check_token(user, token)
    )


class PasswordResetRequestView(APIView):
    """Self-service reset request. Response is identical whether or not the
    email is registered — no account enumeration (FR-004)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"], is_active=True
        ).first()
        if user is not None:
            self._send_reset_email(user)
        return Response(
            {
                "detail": (
                    "If an account exists for this address, "
                    "a password reset link has been sent."
                )
            }
        )

    def _send_reset_email(self, user):
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{settings.FRONTEND_URL}/reset-password/{uidb64}/{token}"
        send_mail(
            subject="CDS Business — password reset",
            message=(
                "A password reset was requested for your CDS account.\n\n"
                f"Open this link to choose a new password (valid for 1 hour):\n{link}\n\n"
                "If you did not request this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )


class PasswordResetConfirmView(APIView):
    """GET validates a link (frontend invalid-link screen); POST resets."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def get(self, request):
        user = _user_from_uidb64(request.query_params.get("uid", ""))
        if not _token_valid(user, request.query_params.get("token", "")):
            return _invalid_token_response()
        return Response({"valid": True})

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _user_from_uidb64(serializer.validated_data["uid"])
        if not _token_valid(user, serializer.validated_data["token"]):
            return _invalid_token_response()
        user.set_password(serializer.validated_data["new_password"])
        if user.must_change_password:
            user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        audit_record(
            user, user, action="password_reset", comment="Password reset via email link"
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)


class MyProfileView(APIView):
    def patch(self, request):
        profile = request.user.profile
        serializer = ProfileUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class EmployeeViewSet(viewsets.ModelViewSet):
    """HR employee administration (FR-007, FR-019, FR-045)."""

    permission_classes = [IsAuthenticated, IsHR]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return (
            User.objects.select_related("profile", "manager")
            .order_by("email")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        if self.action in ("partial_update", "update"):
            return EmployeeUpdateSerializer
        return EmployeeSerializer

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if "is_active" in params:
            queryset = queryset.filter(is_active=params["is_active"] == "true")
        if "manager" in params:
            queryset = queryset.filter(manager_id=params["manager"])
        department = params.get("department")
        if department:
            queryset = queryset.filter(profile__department=department)
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(email__icontains=search)
                | Q(profile__first_name__icontains=search)
                | Q(profile__last_name__icontains=search)
            )
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile_fields = {
            k: data.pop(k)
            for k in ("first_name", "last_name", "job_title", "department", "hire_date",
                      "phone", "address")
            if k in data
        }
        temporary_password = secrets.token_urlsafe(9)
        user = User.objects.create_user(
            password=temporary_password, must_change_password=True, **data
        )
        EmployeeProfile.objects.create(user=user, **profile_fields)
        audit_record(
            user, request.user, action="employee_create",
            comment="Employee account created by HR",
        )
        body = EmployeeSerializer(user).data
        body["temporary_password"] = temporary_password  # returned once (FR-007)
        return Response(body, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_fields = {k: data.pop(k) for k in ("role", "manager", "is_active") if k in data}
        profile_fields = {
            k: v for k, v in data.items()
            if k in ("first_name", "last_name", "job_title", "department", "hire_date")
        }
        for field, value in user_fields.items():
            setattr(user, field, value)
        if user_fields:
            user.save()
            audit_record(
                user, request.user, action="employee_update",
                comment=f"Updated fields: {', '.join(user_fields)}",
            )
        if profile_fields:
            profile = user.profile
            for field, value in profile_fields.items():
                setattr(profile, field, value)
            profile.save()
            audit_record(
                user, request.user, action="profile_update",
                comment=f"HR updated profile fields: {', '.join(profile_fields)}",
            )
        return Response(EmployeeSerializer(user).data)

    @transaction.atomic
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        temporary_password = secrets.token_urlsafe(9)
        user.set_password(temporary_password)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
        audit_record(
            user, request.user, action="credential_reset",
            comment="HR reset user password",
        )
        return Response({"temporary_password": temporary_password})


class TeamView(APIView):
    """Manager's direct reports with live pending-review counts (FR-018)."""

    def get(self, request):
        if request.user.role != "MANAGER":
            return Response(
                {"error": {"code": "forbidden", "message": "Manager role required."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        from apps.requests.models import Request
        from apps.timesheets.models import Timesheet

        reports = User.objects.filter(manager=request.user, is_active=True).select_related(
            "profile"
        )
        members = []
        for report in reports:
            pending = queue_items(request.user, Request.objects.all()).filter(
                submitter=report
            ).count() + queue_items(request.user, Timesheet.objects.all()).filter(
                submitter=report
            ).count()
            data = TeamMemberSerializer(report).data
            data["pending_items"] = pending
            members.append(data)
        return Response(members)
