"""Report API — JSON reports + file exports. Every handler parses filters,
runs the scoped builder and paginates/exports the identical row source, so
exports can never see more than the on-screen report."""
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.pagination import StandardPagination

from . import exports
from .filters import parse_filters
from .services import REPORTS, scope_payload

_CONTENT_TYPES = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def _spec_or_404(key):
    spec = REPORTS.get(key)
    if spec is None:
        raise NotFound()
    return spec


def _result(request, key):
    spec = _spec_or_404(key)
    f = parse_filters(
        request,
        status_choices=spec["status_choices"],
        allow_request_type=spec["allow_request_type"],
    )
    return spec["builder"](request.user, f), f


class ScopeView(APIView):
    """GET /api/reports/scope/ — employees/departments/request types the caller
    may use in report filters (already scoped to their role)."""

    def get(self, request):
        return Response(scope_payload(request.user))


class ReportView(APIView):
    """GET /api/reports/<report>/ — paginated rows + summary over the *full*
    filtered scope (not just the page)."""

    report_key = None

    def get(self, request):
        result, _f = _result(request, self.report_key)
        paginator = StandardPagination()
        # paginate_queryset handles both querysets (attendance/timesheets/
        # requests) and materialized lists (employee summary).
        page = paginator.paginate_queryset(result.rows, request)
        response = paginator.get_paginated_response(result.finalize(page))
        response.data["summary"] = result.summary
        response.data["meta"] = {**result.meta, "generated_at": timezone.now()}
        return response


class AttendanceReportView(ReportView):
    report_key = "attendance"


class TimesheetsReportView(ReportView):
    report_key = "timesheets"


class RequestsReportView(ReportView):
    report_key = "requests"


class EmployeesReportView(ReportView):
    report_key = "employees"


class ReportExportView(APIView):
    """GET /api/reports/<report>/export/?fmt=xlsx|pdf — same filters and
    authorization scope as the JSON report; size-capped server-side.
    (`format` is DRF's reserved format-suffix query param — hence `fmt`.)"""

    def get(self, request, report_key):
        fmt = (request.query_params.get("fmt") or "").lower()
        if fmt not in _CONTENT_TYPES:
            raise ValidationError({"fmt": "Expected xlsx or pdf."})
        result, f = _result(request, report_key)
        materialized = list(result.rows)
        exports.check_export_size(report_key, fmt, len(materialized))
        rows = result.finalize(materialized)
        meta = {**result.meta, "filters": f.applied}
        if fmt == "xlsx":
            payload = exports.build_xlsx(
                report_key, rows=rows, summary=result.summary, meta=meta, lang=f.lang
            )
        else:
            payload = exports.build_pdf(
                report_key, rows=rows, summary=result.summary, meta=meta, lang=f.lang
            )
        response = HttpResponse(payload, content_type=_CONTENT_TYPES[fmt])
        response["Content-Disposition"] = (
            f'attachment; filename="{exports.export_filename(report_key, fmt, f)}"'
        )
        return response
