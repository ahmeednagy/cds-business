"""US6 — weekly timesheets: entries, uniqueness, workflow (FR-024–FR-027)."""
import pytest

from apps.timesheets.models import Timesheet
from tests.factories import (
    ManagerUserFactory,
    ManagerWorkflowFactory,
    TimesheetFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _workflow(db):
    ManagerWorkflowFactory(name="Manager approval")


def _week(monday):
    return {
        "week_start": monday,
        "entries": [
            {"date": monday, "hours": 8},
            {"date": "2024-01-02", "hours": 7.5},
        ],
    }


def test_employee_submits_timesheet(auth_client):
    user = UserFactory()
    response = auth_client(user).post(
        "/api/timesheets/",
        {"week_start": "2024-01-01",
         "entries": [{"date": "2024-01-01", "hours": 8},
                     {"date": "2024-01-02", "hours": 7.5}]},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "PENDING"
    assert response.data["total_hours"] == 15.5


def test_duplicate_week_rejected(auth_client):
    user = UserFactory()
    payload = {"week_start": "2024-01-01", "entries": [{"date": "2024-01-01", "hours": 8}]}
    assert auth_client(user).post("/api/timesheets/", payload, format="json").status_code == 201
    assert auth_client(user).post("/api/timesheets/", payload, format="json").status_code == 409


def test_entry_outside_week_rejected(auth_client):
    user = UserFactory()
    response = auth_client(user).post(
        "/api/timesheets/",
        {"week_start": "2024-01-01", "entries": [{"date": "2024-01-10", "hours": 8}]},
        format="json",
    )
    assert response.status_code == 400


def test_non_monday_week_start_rejected(auth_client):
    user = UserFactory()
    response = auth_client(user).post(
        "/api/timesheets/",
        {"week_start": "2024-01-03", "entries": [{"date": "2024-01-03", "hours": 8}]},
        format="json",
    )
    assert response.status_code == 400


def test_manager_approves_timesheet(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    sheet = TimesheetFactory(submitter=employee, week_start="2024-02-05")
    response = auth_client(manager).post(f"/api/timesheets/{sheet.pk}/approve/")
    assert response.status_code == 200
    sheet.refresh_from_db()
    assert sheet.status == "APPROVED"


def test_approved_timesheet_read_only(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    sheet = TimesheetFactory(submitter=employee, week_start="2024-02-12")
    auth_client(manager).post(f"/api/timesheets/{sheet.pk}/approve/")
    assert auth_client(employee).post(f"/api/timesheets/{sheet.pk}/withdraw/").status_code == 409


def test_withdraw_pending_timesheet(auth_client):
    user = UserFactory()
    sheet = TimesheetFactory(submitter=user)
    response = auth_client(user).post(f"/api/timesheets/{sheet.pk}/withdraw/")
    assert response.status_code == 200
    sheet.refresh_from_db()
    assert sheet.status == "WITHDRAWN"


def test_return_and_resubmit_timesheet(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    sheet = TimesheetFactory(submitter=employee, week_start="2024-03-04")
    auth_client(manager).post(
        f"/api/timesheets/{sheet.pk}/return/", {"comment": "fix monday"}
    )
    sheet.refresh_from_db()
    assert sheet.status == "RETURNED"
    response = auth_client(employee).post(
        f"/api/timesheets/{sheet.pk}/submit/",
        {"week_start": "2024-03-04", "entries": [{"date": "2024-03-04", "hours": 6}]},
        format="json",
    )
    assert response.status_code == 200
    sheet.refresh_from_db()
    assert sheet.status == "PENDING"
    assert sheet.entries.get().hours == 6


def test_employee_timesheet_scoping(auth_client):
    user, other = UserFactory(), UserFactory()
    mine = TimesheetFactory(submitter=user)
    TimesheetFactory(submitter=other)
    response = auth_client(user).get("/api/timesheets/")
    ids = [t["id"] for t in response.data["results"]]
    assert ids == [mine.pk]
    assert auth_client(user).get(f"/api/timesheets/{Timesheet.objects.exclude(pk=mine.pk).first().pk}/").status_code == 404
