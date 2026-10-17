"""US8 — HR administration: employees, credentials, types, workflows (FR-007, FR-019)."""
import pytest

from apps.accounts.models import User
from tests.factories import (
    HRUserFactory,
    ManagerUserFactory,
    ManagerWorkflowFactory,
    RequestTypeFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


def test_hr_creates_employee_with_temp_password(auth_client):
    hr = HRUserFactory()
    response = auth_client(hr).post(
        "/api/employees/",
        {"email": "new@cdsbusiness.dev", "role": "EMPLOYEE", "first_name": "Nora"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["temporary_password"]
    user = User.objects.get(email="new@cdsbusiness.dev")
    assert user.must_change_password is True
    assert user.check_password(response.data["temporary_password"])


def test_hr_resets_password(api_client):
    hr = HRUserFactory()
    user = UserFactory(email="reset@cdsbusiness.dev")
    api_client.force_authenticate(hr)
    response = api_client.post(f"/api/employees/{user.pk}/reset-password/")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.must_change_password is True
    assert user.check_password(response.data["temporary_password"])
    # Old password no longer works.
    api_client.force_authenticate(user=None)
    assert api_client.post(
        "/api/auth/login/", {"email": "reset@cdsbusiness.dev", "password": "Test!Passw0rd"}
    ).status_code == 401


def test_non_hr_cannot_administer_employees(auth_client):
    employee = UserFactory()
    assert auth_client(employee).get("/api/employees/").status_code == 403
    assert auth_client(employee).post("/api/employees/", {"email": "x@x.dev"}).status_code == 403


def test_manager_cannot_administer_employees(auth_client):
    manager = ManagerUserFactory()
    assert auth_client(manager).get("/api/employees/").status_code == 403


def test_hr_manages_request_types(auth_client):
    hr = HRUserFactory()
    workflow = ManagerWorkflowFactory()
    response = auth_client(hr).post(
        "/api/request-types/",
        {"name": "Expense", "workflow": workflow.pk,
         "fields_schema": [{"key": "amount", "label": "Amount",
                            "type": "number", "required": True}]},
        format="json",
    )
    assert response.status_code == 201
    type_id = response.data["id"]
    assert auth_client(hr).patch(
        f"/api/request-types/{type_id}/", {"is_active": False}, format="json"
    ).status_code == 200


def test_non_hr_cannot_manage_request_types(auth_client):
    employee = UserFactory()
    assert auth_client(employee).post(
        "/api/request-types/", {"name": "X", "workflow": 1}, format="json"
    ).status_code == 403


def test_employees_see_only_active_types(auth_client):
    RequestTypeFactory(name="Active")
    RequestTypeFactory(name="Retired", is_active=False)
    response = auth_client(UserFactory()).get("/api/request-types/")
    names = [t["name"] for t in response.data["results"]]
    assert "Active" in names and "Retired" not in names


def test_hr_manages_workflows(auth_client):
    hr = HRUserFactory()
    response = auth_client(hr).post(
        "/api/workflows/",
        {"name": "Two-step", "steps": [
            {"order": 1, "actor_role": "MANAGER"},
            {"order": 2, "actor_role": "HR"},
        ]},
        format="json",
    )
    assert response.status_code == 201
    workflow_id = response.data["id"]
    # In-flight items keep their snapshot even after the workflow changes.
    from apps.workflows.models import Workflow

    workflow = Workflow.objects.get(pk=workflow_id)
    assert workflow.steps.count() == 2


def test_deactivation_blocks_access(api_client):
    hr = HRUserFactory()
    user = UserFactory(email="bye@cdsbusiness.dev")
    api_client.force_authenticate(hr)
    api_client.patch(f"/api/employees/{user.pk}/", {"is_active": False}, format="json")
    api_client.force_authenticate(user=None)
    assert api_client.post(
        "/api/auth/login/", {"email": "bye@cdsbusiness.dev", "password": "Test!Passw0rd"}
    ).status_code == 401
    # Record retained.
    assert User.objects.filter(email="bye@cdsbusiness.dev").exists()


def test_employee_list_filters(auth_client):
    hr = HRUserFactory()
    UserFactory(email="active@cdsbusiness.dev")
    UserFactory(email="inactive@cdsbusiness.dev", is_active=False)
    response = auth_client(hr).get("/api/employees/?is_active=false")
    emails = [u["email"] for u in response.data["results"]]
    assert "inactive@cdsbusiness.dev" in emails
    assert "active@cdsbusiness.dev" not in emails
