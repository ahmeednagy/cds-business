"""Self-service password reset — request, token lifecycle, confirm."""
import re
from datetime import timedelta

import pytest
from django.conf import settings as dj_settings
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.throttling import SimpleRateThrottle

from tests.factories import UserFactory

pytestmark = pytest.mark.django_db

REQUEST_URL = "/api/auth/password-reset/"
CONFIRM_URL = "/api/auth/password-reset/confirm/"
NEW_PASSWORD = "N3w!SecurePass99"


def _link_parts(user):
    return (
        urlsafe_base64_encode(force_bytes(user.pk)),
        default_token_generator.make_token(user),
    )


def test_request_existing_email_sends_link(api_client, settings):
    settings.FRONTEND_URL = "http://localhost:5173"
    user = UserFactory(email="reset-me@cdsbusiness.dev")
    response = api_client.post(REQUEST_URL, {"email": user.email})
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == [user.email]
    match = re.search(r"/reset-password/(\S+)/(\S+)", message.body)
    assert match, "reset link missing from email body"


def test_request_unknown_email_same_public_response(api_client):
    UserFactory(email="exists@cdsbusiness.dev")
    known = api_client.post(REQUEST_URL, {"email": "exists@cdsbusiness.dev"})
    mail.outbox.clear()
    unknown = api_client.post(REQUEST_URL, {"email": "ghost@cdsbusiness.dev"})
    assert unknown.status_code == 200
    assert unknown.data == known.data
    assert len(mail.outbox) == 0  # nothing sent for unknown addresses


def test_request_email_case_insensitive(api_client):
    user = UserFactory(email="Case@Test.dev")
    response = api_client.post(REQUEST_URL, {"email": "case@test.dev"})
    assert response.status_code == 200
    assert len(mail.outbox) == 1


def test_request_inactive_user_no_email_same_response(api_client):
    user = UserFactory(email="off@cdsbusiness.dev", is_active=False)
    response = api_client.post(REQUEST_URL, {"email": user.email})
    assert response.status_code == 200
    assert len(mail.outbox) == 0


def test_request_malformed_email_400(api_client):
    response = api_client.post(REQUEST_URL, {"email": "not-an-email"})
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_request_throttled(api_client, monkeypatch):
    UserFactory(email="victim@cdsbusiness.dev")
    cache.clear()  # drop throttle history from earlier tests in this run
    # THROTTLE_RATES is bound at class-definition time, so override_settings
    # can't reach it — patch the class attribute directly.
    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {**SimpleRateThrottle.THROTTLE_RATES, "password_reset": "3/minute"},
    )
    for _ in range(3):
        assert (
            api_client.post(REQUEST_URL, {"email": "victim@cdsbusiness.dev"}).status_code
            == 200
        )
    assert (
        api_client.post(REQUEST_URL, {"email": "victim@cdsbusiness.dev"}).status_code
        == 429
    )


def test_confirm_get_valid_token(api_client):
    user = UserFactory()
    uid, token = _link_parts(user)
    response = api_client.get(CONFIRM_URL, {"uid": uid, "token": token})
    assert response.status_code == 200
    assert response.data["valid"] is True


def test_confirm_get_invalid_token(api_client):
    user = UserFactory()
    uid, _ = _link_parts(user)
    response = api_client.get(CONFIRM_URL, {"uid": uid, "token": "bogus-token"})
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_token"


def test_confirm_get_bad_uid(api_client):
    response = api_client.get(CONFIRM_URL, {"uid": "!!!", "token": "x"})
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_token"


def test_confirm_valid_resets_password(api_client):
    user = UserFactory(must_change_password=True)
    uid, token = _link_parts(user)
    response = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert user.must_change_password is False


def test_confirm_then_login_with_new_password(api_client):
    user = UserFactory(email="flow@cdsbusiness.dev")
    uid, token = _link_parts(user)
    api_client.post(CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD})
    login = api_client.post(
        "/api/auth/login/", {"email": "flow@cdsbusiness.dev", "password": NEW_PASSWORD}
    )
    assert login.status_code == 200
    assert login.data["access"]


def test_confirm_token_single_use(api_client):
    user = UserFactory()
    uid, token = _link_parts(user)
    first = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    )
    assert first.status_code == 204
    replay = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    )
    assert replay.status_code == 400
    assert replay.data["error"]["code"] == "invalid_token"


def test_confirm_expired_token(api_client, monkeypatch):
    user = UserFactory()
    uid, token = _link_parts(user)
    # Simulate validation happening after the timeout has elapsed.
    future = default_token_generator._now() + timedelta(
        seconds=dj_settings.PASSWORD_RESET_TIMEOUT + 1
    )
    monkeypatch.setattr(default_token_generator, "_now", lambda: future)
    response = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "invalid_token"


def test_confirm_weak_password_rejected(api_client):
    user = UserFactory()
    uid, token = _link_parts(user)
    response = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": "short"}
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"
    # Token is NOT consumed by a failed validation — still usable.
    retry = api_client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
    )
    assert retry.status_code == 204


def test_confirm_missing_fields_400(api_client):
    response = api_client.post(CONFIRM_URL, {})
    assert response.status_code == 400


def test_audit_entry_recorded(api_client):
    from apps.audit.models import AuditEntry

    user = UserFactory()
    uid, token = _link_parts(user)
    api_client.post(CONFIRM_URL, {"uid": uid, "token": token, "new_password": NEW_PASSWORD})
    assert AuditEntry.objects.filter(
        actor=user, item_id=user.pk, action="password_reset"
    ).exists()
