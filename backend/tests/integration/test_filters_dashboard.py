"""US9 — pagination, filtering, search scoping, dashboards (FR-038–FR-044)."""
import pytest

from apps.notifications.models import Notification
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
    ManagerWorkflowFactory(name="Manager approval")


def test_pagination_envelope(auth_client):
    user = UserFactory()
    for _ in range(30):
        RequestFactory(submitter=user)
    response = auth_client(user).get("/api/requests/")
    assert set(response.data.keys()) == {"count", "next", "previous", "results"}
    assert response.data["count"] == 30
    assert len(response.data["results"]) == 25
    assert response.data["next"]


def test_page_size_capped(auth_client):
    user = UserFactory()
    for _ in range(120):
        RequestFactory(submitter=user)
    response = auth_client(user).get("/api/requests/?page_size=500")
    assert len(response.data["results"]) == 100


def test_inverted_date_range_rejected(auth_client):
    user = UserFactory()
    response = auth_client(user).get(
        "/api/requests/?date_from=2024-05-01&date_to=2024-04-01"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_inverted_week_range_rejected(auth_client):
    user = UserFactory()
    response = auth_client(user).get(
        "/api/timesheets/?week_from=2024-05-01&week_to=2024-04-01"
    )
    assert response.status_code == 400


def test_status_filter(auth_client):
    user = UserFactory()
    RequestFactory(submitter=user, status="PENDING")
    RequestFactory(submitter=user, status="APPROVED")
    response = auth_client(user).get("/api/requests/?status=APPROVED")
    assert response.data["count"] == 1


def test_search_never_escapes_scope(auth_client):
    user, other = UserFactory(), UserFactory()
    rtype = RequestTypeFactory(name="Annual Leave")
    RequestFactory(submitter=other, request_type=rtype)
    response = auth_client(user).get("/api/requests/?search=leave")
    assert response.data["count"] == 0


def test_employee_dashboard(auth_client):
    user = UserFactory()
    RequestFactory(submitter=user, status="PENDING")
    RequestFactory(submitter=user, status="APPROVED")
    Notification.objects.create(
        recipient=user, item_type="request", item_id=1, message="x"
    )
    response = auth_client(user).get("/api/dashboard/")
    assert response.data["open_requests"] == 1
    assert response.data["unread_notifications"] == 1
    assert "pending_reviews" not in response.data


def test_manager_dashboard(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    RequestFactory(submitter=employee)
    response = auth_client(manager).get("/api/dashboard/")
    assert response.data["pending_reviews"] == 1
    assert response.data["team_size"] == 1


def test_hr_dashboard_aggregates(auth_client):
    hr = HRUserFactory()
    RequestFactory(submitter=UserFactory())
    TimesheetFactory(submitter=UserFactory())
    response = auth_client(hr).get("/api/dashboard/")
    assert "requests_by_status" in response.data
    assert response.data["requests_by_status"]["PENDING"] == 1
    assert "active_employees" in response.data
