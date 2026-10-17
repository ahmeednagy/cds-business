from django.urls import path

from .views import CheckInView, CheckOutView, TodayView, WeekView

urlpatterns = [
    path("attendance/check-in/", CheckInView.as_view(), name="attendance-check-in"),
    path("attendance/check-out/", CheckOutView.as_view(), name="attendance-check-out"),
    path("attendance/today/", TodayView.as_view(), name="attendance-today"),
    path("attendance/week/", WeekView.as_view(), name="attendance-week"),
]
