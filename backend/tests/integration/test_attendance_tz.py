"""Timezone regression tests — attendance dates must derive from the
application's business timezone (Africa/Cairo), never from the stored UTC
instant. A check-in at 02:33 Cairo must land on the local calendar day, not
the previous UTC day. Egypt is UTC+3 on Oct 16–17, 2026 (DST ends Oct 29)."""

from datetime import datetime, timezone as dt_timezone

import pytest
from django.utils import timezone

from apps.attendance.models import AttendanceSession
from tests.factories import UserFactory

CHECK_IN_URL = "/api/attendance/check-in/"


def _check_in_at(auth_client, monkeypatch, utc_dt):
    """POST check-in while the server clock reads `utc_dt` (aware)."""
    monkeypatch.setattr(timezone, "now", lambda: utc_dt)
    return auth_client.post(CHECK_IN_URL)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "utc_dt, expected_local",
    [
        # Oct 16 23:59:30 Cairo = 20:59:30 UTC → stays on Oct 16
        (datetime(2026, 10, 16, 20, 59, 30, tzinfo=dt_timezone.utc), "2026-10-16"),
        # Oct 17 00:01 Cairo = 21:01 UTC Oct 16 → the new local day
        (datetime(2026, 10, 16, 21, 1, 0, tzinfo=dt_timezone.utc), "2026-10-17"),
        # Oct 17 02:33 Cairo = 23:33 UTC Oct 16 → the reported bug
        (datetime(2026, 10, 16, 23, 33, 0, tzinfo=dt_timezone.utc), "2026-10-17"),
    ],
)
def test_check_in_belongs_to_cairo_day(auth_client, monkeypatch, utc_dt, expected_local):
    user = UserFactory()
    client = auth_client(user)
    response = _check_in_at(client, monkeypatch, utc_dt)
    assert response.status_code == 201, response.data
    assert response.data["work_date"] == expected_local
    session = AttendanceSession.objects.get(submitter=user)
    assert str(session.work_date) == expected_local
    # Timestamp itself is stored timezone-aware (UTC underneath)
    assert session.check_in_at == utc_dt


@pytest.mark.django_db
def test_today_endpoint_uses_local_day(auth_client, monkeypatch):
    user = UserFactory()
    client = auth_client(user)
    # Check in just after local midnight → today must contain it
    _check_in_at(
        client, monkeypatch, datetime(2026, 10, 16, 21, 1, tzinfo=dt_timezone.utc)
    )
    response = client.get("/api/attendance/today/")
    assert response.status_code == 200
    assert response.data["active"]["work_date"] == "2026-10-17"


@pytest.mark.django_db
def test_work_date_is_derived_after_tz_conversion():
    """Date grouping happens AFTER converting to local time — the same UTC
    instant must never be grouped by its UTC calendar day."""
    ts = datetime(2026, 10, 16, 23, 33, tzinfo=dt_timezone.utc)
    assert timezone.localtime(ts).date().isoformat() == "2026-10-17"
    assert ts.astimezone(dt_timezone.utc).date().isoformat() == "2026-10-16"
    assert timezone.localdate(ts).isoformat() == "2026-10-17"
