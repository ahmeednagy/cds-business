"""US3 — request lifecycle: create, validate, track, resubmit, withdraw (FR-011–FR-023)."""
import pytest

from apps.requests.models import Request
from apps.workflows import services as wf
from tests.factories import (
    ManagerUserFactory,
    RequestFactory,
    RequestTypeFactory,
    TwoStepWorkflowFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


def _create(client, request_type, values=None, comment=""):
    return client.post(
        "/api/requests/",
        {"request_type": request_type.pk,
         "values": values if values is not None else {"reason": "x"},
         "comment": comment},
        format="json",
    )


def test_employee_submits_request(auth_client):
    user = UserFactory()
    rtype = RequestTypeFactory()
    response = _create(auth_client(user), rtype)
    assert response.status_code == 201
    assert response.data["status"] == "PENDING"
    assert response.data["current_actor_role"] == "MANAGER"
    assert "withdraw" in response.data["actions"]


def test_required_fields_validated(auth_client):
    user = UserFactory()
    rtype = RequestTypeFactory()
    response = _create(auth_client(user), rtype, values={})
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_workflow_snapshot_captured(auth_client):
    user = UserFactory()
    rtype = RequestTypeFactory(workflow=TwoStepWorkflowFactory())
    response = _create(auth_client(user), rtype)
    assert response.status_code == 201
    item = Request.objects.get(pk=response.data["id"])
    assert item.requires_hr_review is True
    assert len(item.workflow_snapshot) == 2


def test_employee_lists_only_own_requests(auth_client):
    user, other = UserFactory(), UserFactory()
    mine = RequestFactory(submitter=user)
    RequestFactory(submitter=other)
    response = auth_client(user).get("/api/requests/")
    assert response.status_code == 200
    ids = [r["id"] for r in response.data["results"]]
    assert ids == [mine.pk]


def test_other_users_request_detail_masked(auth_client):
    user, other = UserFactory(), UserFactory()
    item = RequestFactory(submitter=other)
    assert auth_client(user).get(f"/api/requests/{item.pk}/").status_code == 404


def test_inactive_request_type_rejected(auth_client):
    user = UserFactory()
    rtype = RequestTypeFactory(is_active=False)
    assert _create(auth_client(user), rtype).status_code == 400


def test_return_then_resubmit(auth_client):
    user = UserFactory()
    manager = ManagerUserFactory()
    user.manager = manager
    user.save()
    item = RequestFactory(submitter=user)
    auth_client(manager).post(
        f"/api/requests/{item.pk}/return/", {"comment": "fix it"}, format="json"
    )
    item.refresh_from_db()
    assert item.status == "RETURNED"
    response = auth_client(user).post(
        f"/api/requests/{item.pk}/submit/",
        {"values": {"reason": "corrected"}}, format="json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == "PENDING"
    assert item.values["reason"] == "corrected"


def test_resubmit_rejected_when_not_returned(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    assert auth_client(user).post(f"/api/requests/{item.pk}/submit/").status_code == 409


def test_withdraw_pending_request(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    response = auth_client(user).post(f"/api/requests/{item.pk}/withdraw/")
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == "WITHDRAWN"


def test_withdraw_after_reviewer_action_rejected(auth_client):
    user = UserFactory()
    manager = ManagerUserFactory()
    user.manager = manager
    user.save()
    item = RequestFactory(submitter=user)
    auth_client(manager).post(f"/api/requests/{item.pk}/return/", {"comment": "x"})
    # After reviewer action + resubmission, withdrawal must fail.
    auth_client(user).post(f"/api/requests/{item.pk}/submit/")
    response = auth_client(user).post(f"/api/requests/{item.pk}/withdraw/")
    assert response.status_code == 409


def test_final_request_immutable(auth_client):
    user = UserFactory()
    manager = ManagerUserFactory()
    user.manager = manager
    user.save()
    item = RequestFactory(submitter=user)
    auth_client(manager).post(f"/api/requests/{item.pk}/approve/")
    item.refresh_from_db()
    assert item.status == "APPROVED"
    # No further transitions allowed.
    assert auth_client(user).post(f"/api/requests/{item.pk}/withdraw/").status_code == 409
    assert auth_client(manager).post(f"/api/requests/{item.pk}/approve/").status_code == 403


def test_search_filters_by_type_name(auth_client):
    user = UserFactory()
    leave = RequestTypeFactory(name="Annual Leave")
    RequestFactory(submitter=user, request_type=leave)
    RequestFactory(submitter=user, request_type=RequestTypeFactory(name="Expense"))
    response = auth_client(user).get("/api/requests/?search=leave")
    assert response.data["count"] == 1


def test_audit_records_transitions(auth_client):
    from apps.audit.models import AuditEntry

    user = UserFactory()
    item = RequestFactory(submitter=user)
    auth_client(user).post(f"/api/requests/{item.pk}/withdraw/")
    actions = list(
        AuditEntry.objects.filter(item_type="request", item_id=item.pk)
        .values_list("action", flat=True)
    )
    assert actions == ["withdraw"]
