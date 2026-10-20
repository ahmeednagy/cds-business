"""US1 — authentication, session lifecycle, forced password change (FR-001–FR-008)."""
import pytest
from django.conf import settings

from tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _login(client, email, password="Test!Passw0rd"):
    return client.post("/api/auth/login/", {"email": email, "password": password})


def test_login_returns_access_and_sets_refresh_cookie(api_client):
    user = UserFactory(email="a@cdsbusiness.dev")
    response = _login(api_client, user.email)
    assert response.status_code == 200
    assert response.data["access"]
    cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
    assert cookie["httponly"]
    assert cookie["samesite"] == "Lax"


def test_login_wrong_password_generic_401(api_client):
    user = UserFactory(email="b@cdsbusiness.dev")
    response = _login(api_client, user.email, password="wrong-pass")
    assert response.status_code == 401
    assert response.data["error"]["code"] == "unauthenticated"
    assert "email" not in response.data["error"]["message"].lower()


def test_login_unknown_email_same_generic_401(api_client):
    response = _login(api_client, "ghost@cdsbusiness.dev")
    assert response.status_code == 401
    assert response.data["error"]["message"] == "Invalid credentials."


def test_deactivated_user_cannot_login(api_client):
    user = UserFactory(email="off@cdsbusiness.dev", is_active=False)
    assert _login(api_client, user.email).status_code == 401


def test_protected_endpoint_requires_auth(api_client):
    assert api_client.get("/api/requests/").status_code == 401


def test_expired_or_invalid_token_rejected(api_client):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer garbage")
    assert api_client.get("/api/me/").status_code == 401


def _tokens(client, email, password="Test!Passw0rd"):
    response = client.post("/api/auth/login/", {"email": email, "password": password})
    return response


def test_refresh_rotates_and_issues_access(api_client):
    user = UserFactory(email="c@cdsbusiness.dev")
    _tokens(api_client, user.email)
    response = api_client.post("/api/auth/refresh/")
    assert response.status_code == 200
    assert response.data["access"]


def test_refresh_without_cookie_rejected(api_client):
    assert api_client.post("/api/auth/refresh/").status_code == 401


def test_logout_blacklists_refresh(api_client):
    user = UserFactory(email="d@cdsbusiness.dev")
    login = _tokens(api_client, user.email)
    access = login.data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert api_client.post("/api/auth/logout/").status_code == 204
    # Cookie cleared — refresh now fails.
    assert api_client.post("/api/auth/refresh/").status_code == 401


def test_must_change_password_gate(api_client):
    user = UserFactory(email="new@cdsbusiness.dev", must_change_password=True)
    login = _tokens(api_client, user.email)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    # Gated: ordinary protected endpoints refuse until password changed.
    assert api_client.get("/api/requests/").status_code == 403
    assert api_client.get("/api/me/").status_code == 200
    # Change password clears the flag.
    response = api_client.post(
        "/api/auth/change-password/",
        {"current_password": "Test!Passw0rd", "new_password": "New!Passw0rd1"},
    )
    assert response.status_code == 204
    assert api_client.get("/api/requests/").status_code == 200


def test_change_password_validates_current(api_client):
    user = UserFactory(email="e@cdsbusiness.dev")
    login = _tokens(api_client, user.email)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = api_client.post(
        "/api/auth/change-password/",
        {"current_password": "wrong", "new_password": "New!Passw0rd1"},
    )
    assert response.status_code == 400


def test_change_password_enforces_strength(api_client):
    user = UserFactory(email="f@cdsbusiness.dev")
    login = _tokens(api_client, user.email)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = api_client.post(
        "/api/auth/change-password/",
        {"current_password": "Test!Passw0rd", "new_password": "short"},
    )
    assert response.status_code == 400


# ---------- Demo quick login ----------

QUICK_LOGIN_ACCOUNTS = {
    "ahmed": "ahmed.nagy@cdsbussiness.com",
    "manager": "ramadan.khalil@cdsbussiness.com",
    "hr": "shrouk.youssry@cdsbussiness.com",
}


@pytest.fixture
def quick_login(settings):
    settings.DEMO_QUICK_LOGIN = "1"
    settings.DEMO_QUICK_LOGIN_ACCOUNTS = QUICK_LOGIN_ACCOUNTS
    return settings


def test_quick_login_disabled_by_default_in_non_debug(api_client):
    assert api_client.get("/api/auth/quick-login/").status_code == 404
    assert (
        api_client.post("/api/auth/quick-login/", {"key": "ahmed"}).status_code
        == 404
    )


def test_quick_login_lists_only_existing_active_accounts(
    api_client, quick_login
):
    UserFactory(email=QUICK_LOGIN_ACCOUNTS["ahmed"])
    UserFactory(email=QUICK_LOGIN_ACCOUNTS["manager"], is_active=False)
    response = api_client.get("/api/auth/quick-login/")
    assert response.status_code == 200
    assert response.data["accounts"] == ["ahmed"]


def test_quick_login_issues_same_session_as_login(api_client, quick_login):
    user = UserFactory(email=QUICK_LOGIN_ACCOUNTS["hr"])
    response = api_client.post("/api/auth/quick-login/", {"key": "hr"})
    assert response.status_code == 200
    assert response.data["access"]
    assert settings.REFRESH_COOKIE_NAME in response.cookies
    # The issued access token authenticates exactly like a normal login.
    api_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {response.data['access']}"
    )
    me = api_client.get("/api/me/")
    assert me.status_code == 200
    assert me.data["email"] == user.email


def test_quick_login_unknown_key_404(api_client, quick_login):
    response = api_client.post("/api/auth/quick-login/", {"key": "ghost"})
    assert response.status_code == 404


def test_quick_login_missing_or_inactive_user_404(api_client, quick_login):
    UserFactory(email=QUICK_LOGIN_ACCOUNTS["ahmed"], is_active=False)
    response = api_client.post("/api/auth/quick-login/", {"key": "ahmed"})
    assert response.status_code == 404
