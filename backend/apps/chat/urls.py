from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ChatUnreadView,
    ContactViewSet,
    ConversationViewSet,
    FailedCallView,
    PresenceView,
)

router = DefaultRouter()
router.register("chat/conversations", ConversationViewSet, basename="chat-conversation")
router.register("chat/contacts", ContactViewSet, basename="chat-contact")

urlpatterns = [
    path("chat/unread/", ChatUnreadView.as_view(), name="chat-unread"),
    path("chat/presence/", PresenceView.as_view(), name="chat-presence"),
    path("chat/calls/failed/", FailedCallView.as_view(), name="chat-call-failed"),
    *router.urls,
]
