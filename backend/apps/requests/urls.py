from rest_framework.routers import DefaultRouter

from .views import AttachmentViewSet, RequestTypeViewSet, RequestViewSet

router = DefaultRouter()
router.register("request-types", RequestTypeViewSet, basename="request-type")
router.register("requests", RequestViewSet, basename="request")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = router.urls
