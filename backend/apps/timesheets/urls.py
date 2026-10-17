from rest_framework.routers import DefaultRouter

from .views import TimesheetViewSet

router = DefaultRouter()
router.register("timesheets", TimesheetViewSet, basename="timesheet")

urlpatterns = router.urls
