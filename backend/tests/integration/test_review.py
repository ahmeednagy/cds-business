"""US5 — manager/HR review queues, actions, conflicts (FR-018–FR-022)."""
import pytest

from tests.factories import (
    HRUserFactory,
    ManagerUserFactory,
    RequestFactory,
    RequestTypeFactory,
    TwoStepWorkflowFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(db):
    manager = ManagerUserFactory(email="mgr@cdsbusiness.dev")
    employee = UserFactory(manager=manager)
    return manager, employee


def test_manager_sees_reports_pending_items(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    response = auth_client(manager).get("/api/requests/?pending_review=true")
    ids = [r["id"] for r in response.data["results"]]
    assert item.pk in ids


def test_manager_approves(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    response = auth_client(manager).post(f"/api/requests/{item.pk}/approve/")
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == "APPROVED"


def test_reject_requires_comment(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    response = auth_client(manager).post(f"/api/requests/{item.pk}/reject/")
    assert response.status_code == 400
    response = auth_client(manager).post(
        f"/api/requests/{item.pk}/reject/", {"comment": "no budget"}
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == "REJECTED"


def test_return_requires_comment(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    assert auth_client(manager).post(f"/api/requests/{item.pk}/return/").status_code == 400


def test_non_report_review_denied(auth_client):
    manager, employee = ManagerUserFactory(), UserFactory()
    other_manager = ManagerUserFactory()
    employee.manager = manager
    employee.save()
    item = RequestFactory(submitter=employee)
    # Other manager cannot even see it (scoping masks existence).
    client = auth_client(other_manager)
    assert client.post(f"/api/requests/{item.pk}/approve/").status_code == 404


def test_double_action_conflict(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    assert auth_client(manager).post(f"/api/requests/{item.pk}/approve/").status_code == 200
    # Second action on a final item → conflict (403: no longer current actor).
    second = auth_client(manager).post(f"/api/requests/{item.pk}/approve/")
    assert second.status_code in (403, 409)


def test_pending_items_follow_live_reporting_line(auth_client):
    """Reassignment moves pending items to the new manager's queue (C3)."""
    old_mgr, new_mgr = ManagerUserFactory(), ManagerUserFactory()
    employee = UserFactory(manager=old_mgr)
    item = RequestFactory(submitter=employee)
    assert auth_client(old_mgr).get("/api/requests/?pending_review=true").data["count"] == 1
    employee.manager = new_mgr
    employee.save()
    assert auth_client(old_mgr).get("/api/requests/?pending_review=true").data["count"] == 0
    assert auth_client(new_mgr).get("/api/requests/?pending_review=true").data["count"] == 1
    # New manager can act immediately.
    assert auth_client(new_mgr).post(f"/api/requests/{item.pk}/approve/").status_code == 200


def test_two_step_workflow_advances_to_hr(auth_client):
    manager, employee = ManagerUserFactory(), UserFactory()
    employee.manager = manager
    employee.save()
    hr = HRUserFactory()
    rtype = RequestTypeFactory(workflow=TwoStepWorkflowFactory())
    item = RequestFactory(submitter=employee, request_type=rtype)
    # Step 1: manager approves → IN_REVIEW at HR step.
    auth_client(manager).post(f"/api/requests/{item.pk}/approve/")
    item.refresh_from_db()
    assert item.status == "IN_REVIEW"
    assert item.current_actor_role == "HR"
    # Manager can no longer act.
    assert auth_client(manager).post(f"/api/requests/{item.pk}/approve/").status_code == 403
    # HR completes step 2.
    assert auth_client(hr).post(f"/api/requests/{item.pk}/approve/").status_code == 200
    item.refresh_from_db()
    assert item.status == "APPROVED"


def test_hr_least_privilege_item_access(auth_client):
    """HR sees only items whose workflow includes an HR step (A1/FR-019)."""
    hr = HRUserFactory()
    employee = UserFactory()
    no_hr = RequestFactory(submitter=employee)  # manager-only workflow
    with_hr = RequestFactory(
        submitter=employee, request_type=RequestTypeFactory(workflow=TwoStepWorkflowFactory())
    )
    response = auth_client(hr).get("/api/requests/")
    ids = [r["id"] for r in response.data["results"]]
    assert with_hr.pk in ids
    assert no_hr.pk not in ids
    assert auth_client(hr).get(f"/api/requests/{no_hr.pk}/").status_code == 404


def test_history_endpoint_chronological(auth_client, setup):
    manager, employee = setup
    item = RequestFactory(submitter=employee)
    auth_client(manager).post(
        f"/api/requests/{item.pk}/return/", {"comment": "fix"}, format="json"
    )
    auth_client(employee).post(f"/api/requests/{item.pk}/submit/")
    response = auth_client(employee).get(f"/api/requests/{item.pk}/history/")
    actions = [e["action"] for e in response.data["results"]]
    assert actions == ["return", "submit"]
    assert response.data["results"][0]["comment"] == "fix"
