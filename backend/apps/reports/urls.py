from django.urls import path

from .views import (
    AttendanceReportView,
    EmployeesReportView,
    ReportExportView,
    RequestsReportView,
    ScopeView,
    TimesheetsReportView,
)

urlpatterns = [
    path("reports/scope/", ScopeView.as_view(), name="report-scope"),
    path("reports/attendance/", AttendanceReportView.as_view(), name="report-attendance"),
    path("reports/timesheets/", TimesheetsReportView.as_view(), name="report-timesheets"),
    path("reports/requests/", RequestsReportView.as_view(), name="report-requests"),
    path("reports/employees/", EmployeesReportView.as_view(), name="report-employees"),
    path("reports/<str:report_key>/export/", ReportExportView.as_view(), name="report-export"),
]
