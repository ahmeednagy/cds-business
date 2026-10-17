"""US7 — in-app notifications + history (FR-032–FR-037)."""
import pytest

from apps.notifications.models import Notification
from tests.factories import (
    ManagerUserFactory,
    RequestFactory,
    RequestTypeFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


def test_submission_notifies_current_reviewer(api_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    rtype = RequestTypeFactory()
    api_client.force_authenticate(employee)
    api_client.post(
        "/api/requests/",
        {"request_type": rtype.pk, "values": {"reason": "x"}},
        format="json",
    )
    assert Notification.objects.filter(recipient=manager).count() == 1
    assert "awaiting your review" in Notification.objects.get(recipient=manager).message


def test_decision_notifies_submitter(api_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    item = RequestFactory(submitter=employee)
    api_client.force_authenticate(manager)
    api_client.post(f"/api/requests/{item.pk}/approve/")
    assert Notification.objects.filter(recipient=employee).count() == 1


def test_no_self_notification(api_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    api_client.force_authenticate(user)
    api_client.post(f"/api/requests/{item.pk}/withdraw/")
    assert Notification.objects.filter(recipient=user).count() == 0


def test_notifications_are_own_only(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    RequestFactory(submitter=employee)
    # Employee must not see the manager's notification.
    response = auth_client(employee).get("/api/notifications/")
    assert response.data["count"] == 0


def test_mark_read(auth_client):
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    item = RequestFactory(submitter=employee)
    Notification.objects.create(
        recipient=manager, item_type="request", item_id=item.pk, message="test"
    )
    notification = Notification.objects.get(recipient=manager)
    assert auth_client(manager).post(
        f"/api/notifications/{notification.pk}/read/"
    ).status_code == 204
    notification.refresh_from_db()
    assert notification.read_at is not None


def test_read_all(auth_client):
    manager = ManagerUserFactory()
    for i in range(3):
        Notification.objects.create(
            recipient=manager, item_type="request", item_id=i + 1, message=f"m{i}"
        )
    response = auth_client(manager).post("/api/notifications/read-all/")
    assert response.data["marked"] == 3
    assert Notification.objects.filter(recipient=manager, read_at__isnull=True).count() == 0


def test_unread_filter(auth_client):
    from django.utils import timezone

    manager = ManagerUserFactory()
    Notification.objects.create(
        recipient=manager, item_type="request", item_id=1, message="unread"
    )
    Notification.objects.create(
        recipient=manager, item_type="request", item_id=2, message="read",
        read_at=timezone.now(),
    )
    response = auth_client(manager).get("/api/notifications/?unread=true")
    assert response.data["count"] == 1


def test_audit_entries_not_editable_via_api(auth_client):
    """No API surface exists for audit mutation — append-only (FR-036)."""
    user = UserFactory()
    response = auth_client(user).options("/api/audit/")
    assert response.status_code in (401, 404)
