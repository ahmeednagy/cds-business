from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls_auth")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.requests.urls")),
    path("api/", include("apps.timesheets.urls")),
    path("api/", include("apps.attendance.urls")),
    path("api/", include("apps.workflows.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.chat.urls")),
    path("api/", include("apps.reports.urls")),
    path("api/", include("apps.core.urls")),
]
