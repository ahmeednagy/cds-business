"""Shared report filter parsing — server-side only (reports never rely on the
client for scoping or validation)."""
from dataclasses import dataclass, field

from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from .services import visible_employees

_DATE_FIELD = serializers.DateField()
_LANGS = ("en", "ar")


@dataclass
class ReportFilters:
    date_from: object = None
    date_to: object = None
    employee_id: int | None = None
    department: str | None = None
    status: str | None = None
    request_type_id: int | None = None
    lang: str = "en"
    applied: dict = field(default_factory=dict)


def _parse_date(raw, name):
    if raw in (None, ""):
        return None
    try:
        return _DATE_FIELD.to_internal_value(raw)
    except serializers.ValidationError:
        raise ValidationError({name: "Invalid date — expected YYYY-MM-DD."})


def _parse_int(raw, name):
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ValidationError({name: "Expected an integer."})


def parse_filters(
    request,
    *,
    status_choices=(),
    allow_request_type=False,
    allow_department=True,
):
    """Parse + validate query params. An inverted date range is a 400, never
    silently corrected."""
    qp = request.query_params
    date_from = _parse_date(qp.get("date_from"), "date_from")
    date_to = _parse_date(qp.get("date_to"), "date_to")
    if date_from and date_to and date_to < date_from:
        raise ValidationError({"date_to": "Must be on or after date_from."})

    employee_id = _parse_int(qp.get("employee"), "employee")
    if employee_id is not None and not visible_employees(request.user).filter(
        pk=employee_id
    ).exists():
        raise ValidationError(
            {"employee": "Employee is outside your reporting scope."}
        )

    department = None
    if allow_department:
        department = (qp.get("department") or "").strip() or None

    status_value = qp.get("status") or None
    if status_value is not None:
        if not status_choices:
            raise ValidationError({"status": "This report has no status filter."})
        status_value = status_value.upper()
        if status_value not in status_choices:
            raise ValidationError(
                {"status": f"Must be one of: {', '.join(status_choices)}."}
            )

    request_type_id = None
    if allow_request_type:
        request_type_id = _parse_int(qp.get("request_type"), "request_type")

    lang = qp.get("lang") or "en"
    if lang not in _LANGS:
        lang = "en"

    applied = {
        k: v
        for k, v in {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "employee": employee_id,
            "department": department,
            "status": status_value,
            "request_type": request_type_id,
        }.items()
        if v is not None
    }
    return ReportFilters(
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
        department=department,
        status=status_value,
        request_type_id=request_type_id,
        lang=lang,
        applied=applied,
    )
