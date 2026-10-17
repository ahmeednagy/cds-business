"""US2 — profile self-service whitelist + manager/HR visibility (FR-009/FR-010)."""
import pytest

from tests.factories import HRUserFactory, ManagerUserFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_employee_views_own_profile(auth_client):
    user = UserFactory(email="me@cdsbusiness.dev")
    response = auth_client(user).get("/api/me/")
    assert response.status_code == 200
    assert response.data["profile"]["first_name"] == "Test"
    assert set(response.data["profile"]["editable_fields"]) == {
        "phone", "address", "personal_email"
    }


def test_employee_edits_whitelisted_fields(auth_client):
    user = UserFactory()
    response = auth_client(user).patch(
        "/api/me/profile/", {"phone": "+961-1-234", "address": "Beirut"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["profile"]["phone"] == "+961-1-234"


def test_employee_cannot_edit_hr_managed_fields(auth_client):
    user = UserFactory()
    response = auth_client(user).patch(
        "/api/me/profile/", {"job_title": "CEO", "first_name": "Boss"}, format="json"
    )
    assert response.status_code == 200
    user.refresh_from_db()
    # Non-whitelisted fields are silently ignored — never applied.
    assert user.profile.job_title != "CEO"
    assert user.profile.first_name == "Test"


def test_employee_cannot_access_other_profiles(auth_client):
    user = UserFactory()
    other = UserFactory()
    assert auth_client(user).get(f"/api/employees/{other.pk}/").status_code == 403


def test_manager_views_direct_report_via_team(auth_client):
    manager = ManagerUserFactory()
    report = UserFactory(manager=manager)
    response = auth_client(manager).get("/api/team/")
    assert response.status_code == 200
    emails = [m["email"] for m in response.data]
    assert report.email in emails


def test_hr_accesses_employee_records(auth_client):
    hr = HRUserFactory()
    employee = UserFactory()
    response = auth_client(hr).get(f"/api/employees/{employee.pk}/")
    assert response.status_code == 200
    assert response.data["email"] == employee.email
