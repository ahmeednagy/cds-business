from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EmployeeViewSet, MeView, MyProfileView, TeamView

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/profile/", MyProfileView.as_view(), name="me-profile"),
    path("team/", TeamView.as_view(), name="team"),
    *router.urls,
]
