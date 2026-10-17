"""Authorization matrix — every endpoint × (anonymous, employee, manager, HR).

Documented expectations per constitution III/IV: server-side RBAC, object-level
scoping, out-of-scope items masked as 404. Extend as new endpoints land.
"""
import pytest

from tests.factories import (
    HRUserFactory,
    ManagerUserFactory,
    ManagerWorkflowFactory,
    RequestFactory,
    RequestTypeFactory,
    TimesheetFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _workflow(db):
    ManagerWorkflowFactory(name="Matrix workflow")


@pytest.fixture
def actors(db):
    hr = HRUserFactory()
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    stranger = UserFactory()
    return {"hr": hr, "manager": manager, "employee": employee, "stranger": stranger}


LIST_CASES = [
    # (path, anonymous, employee, manager, hr)
    ("/api/requests/", 401, 200, 200, 200),
    ("/api/timesheets/", 401, 200, 200, 200),
    ("/api/request-types/", 401, 200, 200, 200),
    ("/api/notifications/", 401, 200, 200, 200),
    ("/api/workflows/", 401, 200, 200, 200),
    ("/api/employees/", 401, 403, 403, 200),
    ("/api/dashboard/", 401, 200, 200, 200),
    ("/api/team/", 401, 403, 200, 403),
    ("/api/me/", 401, 200, 200, 200),
]


@pytest.mark.parametrize("path,anon,emp,mgr,hr", LIST_CASES)
def test_get_matrix(api_client, auth_client, actors, path, anon, emp, mgr, hr):
    assert api_client.get(path).status_code == anon
    assert auth_client(actors["employee"]).get(path).status_code == emp
    assert auth_client(actors["manager"]).get(path).status_code == mgr
    assert auth_client(actors["hr"]).get(path).status_code == hr


WRITE_CASES = [
    # (path, payload, employee, manager, hr) — HR reaches the handler; expected
    # status reflects minimal-payload validity for each endpoint.
    ("/api/employees/", {"email": "x@w.dev"}, 403, 403, 201),
    ("/api/request-types/", {"name": "Matrix T", "workflow": 1}, 403, 403, 201),
    ("/api/workflows/", {"name": "W", "steps": []}, 403, 403, 400),
]


@pytest.mark.parametrize("path,payload,emp,mgr,hr", WRITE_CASES)
def test_write_matrix(auth_client, actors, path, payload, emp, mgr, hr):
    """Non-HR denied; HR proceeds (201 on valid payload, 400 on invalid)."""
    assert auth_client(actors["employee"]).post(path, payload, format="json").status_code == emp
    assert auth_client(actors["manager"]).post(path, payload, format="json").status_code == mgr
    assert auth_client(actors["hr"]).post(path, payload, format="json").status_code == hr


def test_employee_cannot_act_on_others_request(auth_client, actors):
    item = RequestFactory(submitter=actors["stranger"])
    client = auth_client(actors["employee"])
    assert client.get(f"/api/requests/{item.pk}/").status_code == 404
    assert client.post(f"/api/requests/{item.pk}/withdraw/").status_code == 404
    assert client.post(f"/api/requests/{item.pk}/approve/").status_code == 404


def test_employee_cannot_act_on_others_timesheet(auth_client, actors):
    sheet = TimesheetFactory(submitter=actors["stranger"])
    client = auth_client(actors["employee"])
    assert client.get(f"/api/timesheets/{sheet.pk}/").status_code == 404
    assert client.post(f"/api/timesheets/{sheet.pk}/approve/").status_code == 404


def test_employee_cannot_self_promote(auth_client, actors):
    """Role escalation through the employees API is HR-only."""
    employee = actors["employee"]
    assert (
        auth_client(employee).patch(
            f"/api/employees/{employee.pk}/", {"role": "HR"}, format="json"
        ).status_code
        == 403
    )


def test_review_endpoints_require_actor_role(auth_client, actors):
    item = RequestFactory(submitter=actors["stranger"])
    # Manager who is NOT the report's manager is masked out entirely.
    assert (
        auth_client(ManagerUserFactory()).post(
            f"/api/requests/{item.pk}/approve/"
        ).status_code
        == 404
    )
