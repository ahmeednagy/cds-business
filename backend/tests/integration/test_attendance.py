"""Check-in / check-out attendance lifecycle, scoping, and timesheet integration."""
import datetime

import pytest
from django.utils import timezone

from apps.attendance.models import AttendanceSession
from apps.timesheets.models import TimesheetEntry
from tests.factories import (
    AttendanceSessionFactory,
    HRUserFactory,
    ManagerUserFactory,
    ManagerWorkflowFactory,
    TimesheetFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _workflow(db):
    ManagerWorkflowFactory(name="Manager approval")

CHECK_IN = "/api/attendance/check-in/"
CHECK_OUT = "/api/attendance/check-out/"
TODAY = "/api/attendance/today/"
WEEK = "/api/attendance/week/"


def test_check_in_creates_open_session_with_server_timestamp(auth_client):
    user = UserFactory()
    response = auth_client(user).post(CHECK_IN)
    assert response.status_code == 201
    session = AttendanceSession.objects.get(submitter=user)
    assert response.data["id"] == session.id
    assert response.data["check_out_at"] is None
    assert session.check_in_at is not None
    assert session.work_date == timezone.localdate()


def test_duplicate_check_in_returns_conflict(auth_client):
    user = UserFactory()
    assert auth_client(user).post(CHECK_IN).status_code == 201
    response = auth_client(user).post(CHECK_IN)
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conflict"
    assert AttendanceSession.objects.filter(submitter=user).count() == 1


def test_check_out_closes_session_and_calculates_duration(auth_client):
    user = UserFactory()
    session = AttendanceSessionFactory(
        submitter=user, check_in_at=timezone.now() - datetime.timedelta(hours=8)
    )
    response = auth_client(user).post(CHECK_OUT)
    assert response.status_code == 200
    session.refresh_from_db()
    assert session.check_out_at is not None
    assert session.worked_duration is not None
    seconds = response.data["worked_seconds"]
    assert 8 * 3600 <= seconds < 8 * 3600 + 10


def test_check_out_without_active_session_returns_conflict(auth_client):
    user = UserFactory()
    response = auth_client(user).post(CHECK_OUT)
    assert response.status_code == 409
    assert response.data["error"]["code"] == "conflict"


def test_check_out_after_close_returns_conflict(auth_client):
    """An already-checked-out session can't be checked out again."""
    user = UserFactory()
    AttendanceSessionFactory(
        submitter=user,
        check_in_at=timezone.now() - datetime.timedelta(hours=8),
        check_out_at=timezone.now() - datetime.timedelta(minutes=30),
        worked_duration=datetime.timedelta(hours=7, minutes=30),
    )
    assert auth_client(user).post(CHECK_OUT).status_code == 409


def test_today_reflects_active_then_closed_state(auth_client):
    """Backend is the source of truth — state survives a fresh GET (post-refresh)."""
    user = UserFactory()
    assert auth_client(user).post(CHECK_IN).status_code == 201

    response = auth_client(user).get(TODAY)
    assert response.data["active"] is not None
    assert response.data["active"]["check_out_at"] is None

    assert auth_client(user).post(CHECK_OUT).status_code == 200
    response = auth_client(user).get(TODAY)
    assert response.data["active"] is None
    assert len(response.data["sessions"]) == 1
    assert response.data["sessions"][0]["check_out_at"] is not None


def test_today_excludes_other_users_sessions(auth_client):
    user = UserFactory()
    other = UserFactory()
    AttendanceSessionFactory(submitter=other)
    response = auth_client(user).get(TODAY)
    assert response.data["active"] is None
    assert response.data["sessions"] == []


def test_week_returns_monday_anchored_range(auth_client):
    user = UserFactory()
    today = timezone.localdate()
    monday = today - datetime.timedelta(days=today.weekday())
    AttendanceSessionFactory(
        submitter=user,
        work_date=monday,
        check_in_at=timezone.now() - datetime.timedelta(hours=9),
        check_out_at=timezone.now() - datetime.timedelta(hours=1),
        worked_duration=datetime.timedelta(hours=8),
    )
    # Outside the week — must not appear.
    AttendanceSessionFactory(
        submitter=user,
        work_date=monday - datetime.timedelta(days=7),
        check_in_at=timezone.now() - datetime.timedelta(days=7, hours=9),
        check_out_at=timezone.now() - datetime.timedelta(days=7, hours=1),
        worked_duration=datetime.timedelta(hours=8),
    )
    response = auth_client(user).get(WEEK)
    assert response.status_code == 200
    assert response.data["week_start"] == monday
    assert len(response.data["results"]) == 1


def test_week_scopes_by_role(auth_client):
    manager = ManagerUserFactory()
    report = UserFactory(manager=manager)
    outsider = UserFactory()
    hr = HRUserFactory()

    manager_session = AttendanceSessionFactory(submitter=manager)
    report_session = AttendanceSessionFactory(submitter=report)
    outsider_session = AttendanceSessionFactory(submitter=outsider)

    # Employee sees only own records — cannot read a colleague's.
    results = auth_client(outsider).get(WEEK).data["results"]
    assert [s["id"] for s in results] == [outsider_session.id]

    # Manager sees own + direct reports, not outsiders.
    results = auth_client(manager).get(WEEK).data["results"]
    ids = {s["id"] for s in results}
    assert ids == {manager_session.id, report_session.id}

    # HR sees all attendance (administers the organisation).
    results = auth_client(hr).get(WEEK).data["results"]
    assert {s["id"] for s in results} == {
        manager_session.id,
        report_session.id,
        outsider_session.id,
    }


def test_unauthenticated_rejected(api_client):
    assert api_client.get(TODAY).status_code == 401
    assert api_client.post(CHECK_IN).status_code == 401
    assert api_client.post(CHECK_OUT).status_code == 401
    assert api_client.get(WEEK).status_code == 401


def test_must_change_password_user_blocked(auth_client):
    user = UserFactory(must_change_password=True)
    assert auth_client(user).get(TODAY).status_code == 403
    assert auth_client(user).post(CHECK_IN).status_code == 403


def test_timesheet_detail_includes_attendance(auth_client):
    """Attendance surfaces on the weekly timesheet without touching workflow fields."""
    user = UserFactory()
    week_start = "2024-03-04"  # Monday
    sheet = TimesheetFactory(submitter=user, week_start=week_start)
    TimesheetEntry.objects.create(
        timesheet=sheet, date=datetime.date(2024, 3, 4), hours=8
    )
    AttendanceSessionFactory(
        submitter=user,
        work_date=datetime.date(2024, 3, 4),
        check_in_at=datetime.datetime(
            2024, 3, 4, 9, 0, tzinfo=datetime.timezone.utc
        ),
        check_out_at=datetime.datetime(
            2024, 3, 4, 17, 30, tzinfo=datetime.timezone.utc
        ),
        worked_duration=datetime.timedelta(hours=8, minutes=30),
    )
    # A session in another week must not leak in.
    AttendanceSessionFactory(
        submitter=user,
        work_date=datetime.date(2024, 2, 26),
        check_in_at=datetime.datetime(
            2024, 2, 26, 9, 0, tzinfo=datetime.timezone.utc
        ),
        check_out_at=datetime.datetime(
            2024, 2, 26, 17, 0, tzinfo=datetime.timezone.utc
        ),
        worked_duration=datetime.timedelta(hours=8),
    )

    response = auth_client(user).get(f"/api/timesheets/{sheet.pk}/")
    assert response.status_code == 200
    assert len(response.data["attendance"]) == 1
    assert response.data["attendance"][0]["worked_seconds"] == 8 * 3600 + 30 * 60
    assert response.data["attendance_hours"] == 8.5
    # Existing contract unchanged.
    assert response.data["total_hours"] == 8.0
    assert "actions" in response.data


def test_timesheet_days_map_attendance_per_day(auth_client):
    """The `days` array is the deterministic AttendanceSession.work_date →
    timesheet-day mapping: all 7 days present, check-in/out/worked on the
    right day, open sessions flagged, weekly total derivable."""
    user = UserFactory()
    week_start = datetime.date(2024, 3, 4)  # Monday
    sheet = TimesheetFactory(submitter=user, week_start=week_start)
    TimesheetEntry.objects.create(
        timesheet=sheet, date=week_start, hours=8
    )
    # Monday: completed session 09:00→17:30.
    AttendanceSessionFactory(
        submitter=user,
        work_date=week_start,
        check_in_at=datetime.datetime(2024, 3, 4, 9, 0, tzinfo=datetime.timezone.utc),
        check_out_at=datetime.datetime(2024, 3, 4, 17, 30, tzinfo=datetime.timezone.utc),
        worked_duration=datetime.timedelta(hours=8, minutes=30),
    )
    # Tuesday: two sessions same day (break) — must aggregate, not duplicate.
    tue = week_start + datetime.timedelta(days=1)
    for ci, co, dur in (
        (datetime.datetime(2024, 3, 5, 9, 0), datetime.datetime(2024, 3, 5, 13, 0), 4 * 3600),
        (datetime.datetime(2024, 3, 5, 14, 0), datetime.datetime(2024, 3, 5, 18, 0), 4 * 3600),
    ):
        AttendanceSessionFactory(
            submitter=user,
            work_date=tue,
            check_in_at=ci.replace(tzinfo=datetime.timezone.utc),
            check_out_at=co.replace(tzinfo=datetime.timezone.utc),
            worked_duration=datetime.timedelta(seconds=dur),
        )
    # Wednesday: still checked in — open session, no worked time counted.
    wed = week_start + datetime.timedelta(days=2)
    AttendanceSessionFactory(
        submitter=user,
        work_date=wed,
        check_in_at=datetime.datetime(2024, 3, 6, 9, 0, tzinfo=datetime.timezone.utc),
    )

    days = auth_client(user).get(f"/api/timesheets/{sheet.pk}/").data["days"]
    assert len(days) == 7
    mon, tue_row, wed_row, thu = days[0], days[1], days[2], days[3]

    assert mon["date"] == week_start
    assert mon["check_in_at"] is not None
    assert mon["check_out_at"] is not None
    assert mon["worked_seconds"] == 8 * 3600 + 30 * 60
    assert mon["manual_hours"] == 8.0
    assert mon["has_open"] is False

    # Two Tuesday sessions aggregate to 8h; earliest check-in, latest check-out.
    assert tue_row["worked_seconds"] == 8 * 3600
    assert tue_row["has_open"] is False

    # Open session counts zero worked time.
    assert wed_row["has_open"] is True
    assert wed_row["worked_seconds"] == 0
    assert wed_row["check_out_at"] is None

    # Days with no data still appear.
    assert thu["check_in_at"] is None
    assert thu["worked_seconds"] == 0
    assert thu["manual_hours"] is None

    # Weekly worked total = sum of closed durations only.
    assert sum(d["worked_seconds"] for d in days) == 16 * 3600 + 30 * 60


def test_timesheet_days_not_visible_to_other_employee(auth_client):
    """Another employee can't read the submitter's attendance via timesheets
    (detail scoping already 404s for out-of-scope items)."""
    owner = UserFactory()
    other = UserFactory()
    sheet = TimesheetFactory(submitter=owner, week_start="2024-03-04")
    assert auth_client(other).get(f"/api/timesheets/{sheet.pk}/").status_code == 404
