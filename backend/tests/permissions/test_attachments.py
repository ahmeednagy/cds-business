"""US4 — private request attachments: limits, authZ, soft-delete (FR-028–FR-031, FR-045)."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.requests.models import Attachment
from tests.factories import (
    HRUserFactory,
    ManagerUserFactory,
    RequestFactory,
    RequestTypeFactory,
    UserFactory,
)

pytestmark = pytest.mark.django_db


def _file(name="doc.pdf", content=b"%PDF-1.4 fake", ctype="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=ctype)


def test_create_detail_upload_flow(api_client):
    """Regression: create → detail → upload, using the id returned by
    POST /api/requests/ — the exact frontend sequence."""
    user = UserFactory()
    rtype = RequestTypeFactory()
    api_client.force_authenticate(user)
    create = api_client.post(
        "/api/requests/",
        {"request_type": rtype.pk, "values": {"reason": "e2e"}},
        format="json",
    )
    assert create.status_code == 201
    request_id = create.data["id"]
    detail = api_client.get(f"/api/requests/{request_id}/")
    assert detail.status_code == 200
    assert detail.data["id"] == request_id
    upload = api_client.post(
        "/api/attachments/",
        {"request": request_id, "file": _file()},
        format="multipart",
    )
    assert upload.status_code == 201
    assert Attachment.objects.filter(request_id=request_id).count() == 1


def test_hr_can_open_and_attach_to_own_request(api_client):
    """Regression: an HR user's own submissions must stay in scope —
    detail/attachments must not 404 (scope_items HR branch)."""
    hr = HRUserFactory()
    rtype = RequestTypeFactory()  # manager-only workflow → requires_hr_review=False
    api_client.force_authenticate(hr)
    create = api_client.post(
        "/api/requests/",
        {"request_type": rtype.pk, "values": {"reason": "hr own"}},
        format="json",
    )
    assert create.status_code == 201
    request_id = create.data["id"]
    assert api_client.get(f"/api/requests/{request_id}/").status_code == 200
    upload = api_client.post(
        "/api/attachments/",
        {"request": request_id, "file": _file()},
        format="multipart",
    )
    assert upload.status_code == 201


def test_hr_still_cannot_see_others_non_hr_step_request(api_client):
    """Least privilege retained: HR may not view others' items lacking an
    HR workflow step (A1/FR-019)."""
    hr = HRUserFactory()
    item = RequestFactory(submitter=UserFactory())  # manager-only workflow
    api_client.force_authenticate(hr)
    assert api_client.get(f"/api/requests/{item.pk}/").status_code == 404


def test_owner_uploads_attachment(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    response = auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    assert response.status_code == 201
    assert Attachment.objects.filter(request=item).count() == 1


def test_upload_oversize_rejected(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    big = SimpleUploadedFile("big.pdf", b"x" * (10 * 1024 * 1024 + 1), "application/pdf")
    response = auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": big}, format="multipart"
    )
    assert response.status_code == 400


def test_upload_disallowed_type_rejected(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    exe = SimpleUploadedFile("evil.exe", b"MZ", "application/x-msdownload")
    response = auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": exe}, format="multipart"
    )
    assert response.status_code == 400


def test_owner_downloads_attachment(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    attachment = Attachment.objects.get(request=item)
    response = auth_client(user).get(f"/api/attachments/{attachment.pk}/")
    assert response.status_code == 200
    assert b"%PDF" in b"".join(response.streaming_content)


def test_unrelated_user_download_masked_404(auth_client):
    owner, stranger = UserFactory(), UserFactory()
    item = RequestFactory(submitter=owner)
    auth_client(owner).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    attachment = Attachment.objects.get(request=item)
    assert auth_client(stranger).get(f"/api/attachments/{attachment.pk}/").status_code == 404


def test_upload_to_others_request_denied(auth_client):
    owner, stranger = UserFactory(), UserFactory()
    item = RequestFactory(submitter=owner)
    response = auth_client(stranger).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    assert response.status_code in (403, 404)


def test_upload_on_non_editable_request_conflict(auth_client):
    user = UserFactory()
    manager = ManagerUserFactory()
    user.manager = manager
    user.save()
    item = RequestFactory(submitter=user)
    auth_client(manager).post(f"/api/requests/{item.pk}/return/", {"comment": "x"})
    auth_client(user).post(f"/api/requests/{item.pk}/submit/")
    item.refresh_from_db()
    assert item.status == "PENDING"
    response = auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    assert response.status_code == 409


def test_remove_is_soft_delete(auth_client):
    user = UserFactory()
    item = RequestFactory(submitter=user)
    auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    attachment = Attachment.objects.get(request=item)
    response = auth_client(user).delete(f"/api/attachments/{attachment.pk}/")
    assert response.status_code == 204
    attachment.refresh_from_db()
    # Retained per FR-045 but excluded from views/downloads.
    assert attachment.removed_at is not None
    assert auth_client(user).get(f"/api/attachments/{attachment.pk}/").status_code == 404
    detail = auth_client(user).get(f"/api/requests/{item.pk}/")
    assert detail.data["attachments"] == []


def test_attachments_not_allowed_for_type(auth_client):
    user = UserFactory()
    rtype = RequestTypeFactory(allow_attachments=False)
    item = RequestFactory(submitter=user, request_type=rtype)
    response = auth_client(user).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    assert response.status_code == 400


def test_hr_cannot_download_without_hr_step(auth_client):
    owner = UserFactory()
    hr = HRUserFactory()
    item = RequestFactory(submitter=owner)  # manager-only workflow
    auth_client(owner).post(
        "/api/attachments/", {"request": item.pk, "file": _file()}, format="multipart"
    )
    attachment = Attachment.objects.get(request=item)
    assert auth_client(hr).get(f"/api/attachments/{attachment.pk}/").status_code == 404
