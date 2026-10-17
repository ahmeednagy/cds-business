"""Chat — conversations, messages, contacts, unread/read, WS token auth."""
import pytest
from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from apps.chat.middleware import _user_for_token
from apps.chat.models import Call, Conversation, ConversationParticipant, Message
from apps.chat.services import (
    answer_call,
    end_call,
    finalize_timeout,
    get_or_create_direct,
    post_message,
    record_failed_call,
    start_call,
)
from tests.factories import ManagerUserFactory, UserFactory

pytestmark = pytest.mark.django_db


def _direct(a, b, bodies=()):
    conv = get_or_create_direct(a, b)
    for sender, body in bodies:
        post_message(conv, sender, body)
    return conv


# ---------- contacts ----------

def test_contacts_exclude_self_and_inactive(auth_client):
    me = UserFactory()
    active = UserFactory()
    inactive = UserFactory(is_active=False)
    resp = auth_client(me).get("/api/chat/contacts/")
    ids = [u["id"] for u in resp.data["results"]]
    assert active.pk in ids
    assert me.pk not in ids
    assert inactive.pk not in ids


def test_contacts_search(auth_client):
    me = UserFactory()
    match = UserFactory()
    match.profile.first_name = "Ramadan"
    match.profile.job_title = "Engineering Manager"
    match.profile.save()
    UserFactory()
    resp = auth_client(me).get("/api/chat/contacts/?search=ramadan")
    assert [u["id"] for u in resp.data["results"]] == [match.pk]
    resp = auth_client(me).get("/api/chat/contacts/?search=engineering")
    assert [u["id"] for u in resp.data["results"]] == [match.pk]


# ---------- conversation create / reuse ----------

def test_create_direct_conversation(auth_client):
    a, b = UserFactory(), UserFactory()
    resp = auth_client(a).post("/api/chat/conversations/", {"user_id": b.pk})
    assert resp.status_code == 200
    conv = Conversation.objects.get()
    assert conv.kind == "direct"
    assert set(conv.memberships.values_list("user_id", flat=True)) == {a.pk, b.pk}
    assert resp.data["peer"]["id"] == b.pk


def test_create_reuses_existing_direct(auth_client):
    a, b = UserFactory(), UserFactory()
    first = auth_client(a).post("/api/chat/conversations/", {"user_id": b.pk}).data
    second = auth_client(b).post("/api/chat/conversations/", {"user_id": a.pk}).data
    assert first["id"] == second["id"]
    assert Conversation.objects.count() == 1


def test_cannot_message_self_or_inactive(auth_client):
    a = UserFactory()
    inactive = UserFactory(is_active=False)
    c = auth_client(a)
    assert c.post("/api/chat/conversations/", {"user_id": a.pk}).status_code == 400
    assert c.post("/api/chat/conversations/", {"user_id": inactive.pk}).status_code == 400
    assert Conversation.objects.count() == 0


# ---------- authorization ----------

def test_conversations_are_own_only(auth_client):
    a, b, outsider = UserFactory(), UserFactory(), UserFactory()
    _direct(a, b)
    assert auth_client(outsider).get("/api/chat/conversations/").data["count"] == 0
    # Outsider cannot read or post into someone else's conversation.
    conv = Conversation.objects.get()
    c = auth_client(outsider)
    assert c.get(f"/api/chat/conversations/{conv.pk}/messages/").status_code == 404
    assert c.post(
        f"/api/chat/conversations/{conv.pk}/messages/", {"body": "hi"}
    ).status_code == 404
    assert c.post(f"/api/chat/conversations/{conv.pk}/read/").status_code == 404


def test_chat_requires_auth(api_client):
    assert api_client.get("/api/chat/conversations/").status_code == 401
    assert api_client.get("/api/chat/contacts/").status_code == 401
    assert api_client.get("/api/chat/unread/").status_code == 401


# ---------- messaging / unread / read ----------

def test_send_message_and_history(auth_client):
    a, b = UserFactory(), UserFactory()
    conv = _direct(a, b, [(a, "hello"), (b, "hi back")])
    resp = auth_client(a).get(f"/api/chat/conversations/{conv.pk}/messages/")
    assert resp.status_code == 200
    bodies = [m["body"] for m in resp.data["results"]]
    assert bodies == ["hi back", "hello"]  # newest first


def test_unread_counts_and_read(auth_client):
    a, b = UserFactory(), UserFactory()
    conv = _direct(a, b, [(a, "one"), (a, "two")])

    # b sees 2 unread; a sees 0 (own messages + sender auto-read).
    assert auth_client(b).get("/api/chat/unread/").data["count"] == 2
    assert auth_client(a).get("/api/chat/unread/").data["count"] == 0

    convs = auth_client(b).get("/api/chat/conversations/").data["results"]
    assert convs[0]["unread_count"] == 2
    assert convs[0]["last_message"]["body"] == "two"

    # Read → badge zero, conversation cleared.
    assert auth_client(b).post(f"/api/chat/conversations/{conv.pk}/read/").status_code == 204
    assert auth_client(b).get("/api/chat/unread/").data["count"] == 0

    # New message bumps it again.
    post_message(conv, a, "three")
    assert auth_client(b).get("/api/chat/unread/").data["count"] == 1


def test_empty_body_rejected(auth_client):
    a, b = UserFactory(), UserFactory()
    conv = _direct(a, b)
    assert auth_client(a).post(
        f"/api/chat/conversations/{conv.pk}/messages/", {"body": "   "}
    ).status_code == 400


def test_conversation_ordering_latest_first(auth_client):
    me = UserFactory()
    x, y = UserFactory(), UserFactory()
    older = _direct(me, x, [(x, "old")])
    newer = _direct(me, y, [(y, "new")])
    Conversation.objects.filter(pk=older.pk).update(
        last_message_at="2020-01-01T00:00:00Z")
    ids = [c["id"] for c in auth_client(me).get("/api/chat/conversations/").data["results"]]
    assert ids == [newer.pk, older.pk]


# ---------- call history ----------


def _call(a, b, call_id="c1", mode="audio"):
    call = start_call(caller=a, callee_id=b.pk, call_id=call_id, mode=mode)
    assert call is not None
    return call


def test_start_call_persists_ringing(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b)
    assert call.status == "ringing"
    assert call.outcome is None
    assert call.conversation.memberships.count() == 2
    # Idempotent on call_id — a retried invite must not duplicate.
    again = _call(a, b)
    assert again.pk == call.pk and Call.objects.count() == 1


def test_caller_cancel_creates_single_cancelled_event(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b)
    msg = end_call(call.call_id, sender_id=a.pk, event_type="call.end")
    call.refresh_from_db()
    assert call.status == "ended" and call.outcome == "cancelled"
    assert msg.kind == "call" and msg.call_id == call.pk
    assert Message.objects.filter(kind="call").count() == 1


def test_callee_decline_and_busy(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b, "d1")
    end_call("d1", sender_id=b.pk, event_type="call.decline")
    call.refresh_from_db()
    assert call.outcome == "declined"

    busy = _call(a, b, "d2")
    end_call("d2", sender_id=b.pk, event_type="call.decline", reason="busy")
    busy.refresh_from_db()
    assert busy.outcome == "declined"


def test_media_failure_maps_to_failed(auth_client):
    a, b = UserFactory(), UserFactory()
    _call(a, b, "f1")
    end_call("f1", sender_id=b.pk, event_type="call.decline", reason="media")
    assert Call.objects.get(call_id="f1").outcome == "failed"


def test_completed_call_has_real_duration(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b, "ok1")
    assert answer_call("ok1") is True
    Call.objects.filter(pk=call.pk).update(
        answered_at=timezone.now() - timezone.timedelta(seconds=272)
    )
    end_call("ok1", sender_id=b.pk, event_type="call.end")
    call.refresh_from_db()
    assert call.outcome == "completed" and call.duration_seconds == 272
    msg = call.message
    assert msg.kind == "call" and msg.call.mode == "audio"


def test_timeout_marks_missed_and_notifies(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b, "t1", mode="video")
    assert finalize_timeout("t1") is not None
    call.refresh_from_db()
    assert call.outcome == "missed" and call.mode == "video"
    from apps.notifications.models import Notification

    n = Notification.objects.get(recipient=b, item_type="call")
    assert "Missed video call" in n.message
    # Double-finalize is a no-op — one event only.
    assert finalize_timeout("t1") is None
    assert Message.objects.filter(kind="call").count() == 1


def test_finalize_race_first_wins(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b, "r1")
    # Caller cancels; the server timeout firing just after must not re-end it.
    end_call("r1", sender_id=a.pk, event_type="call.end")
    assert finalize_timeout("r1") is None
    call.refresh_from_db()
    assert call.outcome == "cancelled"
    assert Message.objects.filter(kind="call").count() == 1


def test_missed_call_unread_semantics(auth_client):
    a, b = UserFactory(), UserFactory()
    call = _call(a, b, "u1")
    end_call("u1", sender_id=a.pk, event_type="call.end")

    # Recipient sees the missed call as unread; caller does not.
    assert auth_client(b).get("/api/chat/unread/").data["count"] == 1
    assert auth_client(a).get("/api/chat/unread/").data["count"] == 0

    convs = auth_client(b).get("/api/chat/conversations/").data["results"]
    assert convs[0]["unread_count"] == 1
    last = convs[0]["last_message"]
    assert last["kind"] == "call" and last["call"]["outcome"] == "cancelled"

    # Reading the conversation clears it.
    conv = call.conversation
    auth_client(b).post(f"/api/chat/conversations/{conv.pk}/read/")
    assert auth_client(b).get("/api/chat/unread/").data["count"] == 0


def test_call_events_in_message_history(auth_client):
    a, b = UserFactory(), UserFactory()
    _call(a, b, "h1")
    end_call("h1", sender_id=b.pk, event_type="call.decline")
    conv = Conversation.objects.get()
    resp = auth_client(b).get(f"/api/chat/conversations/{conv.pk}/messages/")
    m = resp.data["results"][0]
    assert m["kind"] == "call"
    assert m["call"]["outcome"] == "declined"
    assert m["call"]["mode"] == "audio"
    assert m["sender"] == a.pk


def test_failed_call_endpoint(auth_client):
    a, b = UserFactory(), UserFactory()
    resp = auth_client(a).post(
        "/api/chat/calls/failed/", {"user_id": b.pk, "mode": "video"}
    )
    assert resp.status_code == 201
    call = Call.objects.get()
    assert call.outcome == "failed" and call.mode == "video"
    assert resp.data["kind"] == "call"
    # Bad targets rejected.
    assert auth_client(a).post(
        "/api/chat/calls/failed/", {"user_id": a.pk}
    ).status_code == 400
    assert auth_client(a).post(
        "/api/chat/calls/failed/", {"user_id": 999999}
    ).status_code == 400
    outsider = UserFactory()
    assert (
        auth_client(outsider)
        .post("/api/chat/calls/failed/", {"user_id": b.pk})
        .status_code
        == 201
    )  # any active colleague is callable


def test_non_participant_cannot_end_call(auth_client):
    a, b, outsider = UserFactory(), UserFactory(), UserFactory()
    call = _call(a, b, "x1")
    assert (
        end_call("x1", sender_id=outsider.pk, event_type="call.end") is None
    )
    call.refresh_from_db()
    assert call.status == "ringing"


def test_record_failed_call_service(auth_client):
    a, b = UserFactory(), UserFactory()
    msg = record_failed_call(caller=a, callee=b, mode="audio")
    assert msg.kind == "call" and msg.call.outcome == "failed"
    assert msg.call.duration_seconds == 0


# ---------- conversation list: real activity only ----------


def test_list_excludes_empty_conversations(auth_client):
    a, b, c = UserFactory(), UserFactory(), UserFactory()
    _direct(a, b, [(a, "real")])
    get_or_create_direct(a, c)  # empty shell — must not be listed
    convs = auth_client(a).get("/api/chat/conversations/").data["results"]
    assert [x["id"] for x in convs] == [
        Conversation.objects.filter(memberships__user=b).first().pk
    ]
    # …but the shell stays usable: posting the first message activates it.
    empty = Conversation.objects.filter(memberships__user=c).first()
    assert auth_client(a).post(
        f"/api/chat/conversations/{empty.pk}/messages/", {"body": "hi"}
    ).status_code == 201
    convs = auth_client(a).get("/api/chat/conversations/").data["results"]
    assert {x["id"] for x in convs} == {empty.pk} | {
        x["id"] for x in convs if x["id"] != empty.pk
    }
    assert len(convs) == 2


def test_list_shows_call_event_as_activity(auth_client):
    a, b = UserFactory(), UserFactory()
    _call(a, b, "la1")
    end_call("la1", sender_id=a.pk, event_type="call.end")
    convs = auth_client(b).get("/api/chat/conversations/").data["results"]
    assert convs[0]["last_message"]["kind"] == "call"
    assert convs[0]["unread_count"] == 1


# ---------- WS token auth ----------

def test_ws_token_auth():
    user = UserFactory()
    token = str(AccessToken.for_user(user))
    assert async_to_sync(_user_for_token)(token).pk == user.pk
    assert isinstance(async_to_sync(_user_for_token)("bogus"), AnonymousUser)
    inactive = UserFactory(is_active=False)
    dead = str(AccessToken.for_user(inactive))
    assert isinstance(async_to_sync(_user_for_token)(dead), AnonymousUser)
