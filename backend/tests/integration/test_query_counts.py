"""N+1 guardrails — list endpoints must stay query-bounded (constitution VI)."""
import pytest

from tests.factories import (
    ManagerWorkflowFactory,
    RequestFactory,
    TimesheetFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _workflow(db):
    ManagerWorkflowFactory(name="Perf workflow")


def test_request_list_bounded_queries(auth_client, django_assert_max_num_queries):
    user = UserFactory()
    for _ in range(20):
        RequestFactory(submitter=user)
    with django_assert_max_num_queries(8):
        response = auth_client(user).get("/api/requests/")
        assert response.data["count"] == 20
        list(response.data["results"])


def test_timesheet_list_bounded_queries(auth_client, django_assert_max_num_queries):
    user = UserFactory()
    for _ in range(15):
        TimesheetFactory(submitter=user)
    with django_assert_max_num_queries(6):
        response = auth_client(user).get("/api/timesheets/")
        list(response.data["results"])
        # total_hours serializes via prefetched entries — no per-row queries
