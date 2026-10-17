"""Report builders — server-side scoping, filtering and aggregation.

Every report derives its base queryset through the *existing* RBAC helpers
(`scope_items` for requests/timesheets, `scope_attendance` for attendance) so a
report can never surface data the caller could not already see item-by-item.

CDS Business has no schedule/contract-hours source of truth: required hours,
difference, overtime and lateness are therefore reported as `None` with an
explicit `*_available: false` flag — never invented.
"""
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable, Iterable

from django.db.models import Count, Min, Max, Q, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.attendance.models import AttendanceSession
from apps.attendance.views import scope_attendance
from apps.audit.models import AuditEntry
from apps.core.permissions import scope_items
from apps.requests.models import Request, RequestType
from apps.timesheets.models import Timesheet
from apps.workflows import services as wf

ATTENDANCE_STATUSES = ("PRESENT", "IN_PROGRESS")
ITEM_STATUSES = wf.ALL_STATUSES  # PENDING, IN_REVIEW, RETURNED, APPROVED, REJECTED, WITHDRAWN

# Standardized display grouping for summaries (raw status stays untouched):
# pending covers every not-yet-final state; withdrawn renders as "Cancelled".
STATUS_GROUP = {
    "PENDING": "pending",
    "IN_REVIEW": "pending",
    "RETURNED": "pending",
    "APPROVED": "approved",
    "REJECTED": "rejected",
    "WITHDRAWN": "cancelled",
}


@dataclass
class ReportResult:
    rows: Iterable            # queryset or list — paginated by the view
    finalize: Callable        # (page_items) -> list[dict] with bulk lookups
    summary: dict
    meta: dict


def visible_employees(user):
    """Employees the caller may report on — mirrors the item-level scopes:
    EMPLOYEE → self; MANAGER → self + direct reports; HR → all users (HR's
    attendance scope is organisation-wide)."""
    qs = User.objects.select_related("profile").order_by("email")
    if user.role == "HR":
        return qs
    if user.role == "MANAGER":
        return qs.filter(Q(pk=user.pk) | Q(manager=user))
    return qs.filter(pk=user.pk)


def _emp_label(u):
    name = " ".join(
        p for p in (u.profile.first_name, u.profile.last_name) if p
    ) if hasattr(u, "profile") else ""
    return name or u.email


def _emp_fields(u):
    dept = u.profile.department if hasattr(u, "profile") else ""
    return {
        "employee_id": u.pk,
        "employee_name": _emp_label(u),
        "employee_email": u.email,
        "department": dept,
    }


def _users_map(ids):
    return {
        u.pk: u
        for u in User.objects.filter(pk__in=ids).select_related("profile")
    }


# ---------------------------------------------------------------------------
# 1. Attendance report — one row per employee per work_date.
# ---------------------------------------------------------------------------

def attendance_report(user, f):
    qs = scope_attendance(user, AttendanceSession.objects.all())
    if f.employee_id:
        qs = qs.filter(submitter_id=f.employee_id)
    if f.department:
        qs = qs.filter(submitter__profile__department__iexact=f.department)
    if f.date_from:
        qs = qs.filter(work_date__gte=f.date_from)
    if f.date_to:
        qs = qs.filter(work_date__lte=f.date_to)

    rows = (
        qs.values("submitter_id", "work_date")
        .annotate(
            sessions=Count("id"),
            first_check_in=Min("check_in_at"),
            last_check_out=Max("check_out_at"),
            worked=Sum("worked_duration"),
            open_sessions=Count("id", filter=Q(check_out_at__isnull=True)),
        )
        .order_by("-work_date", "submitter__email")
    )
    if f.status == "IN_PROGRESS":
        rows = rows.filter(open_sessions__gt=0)
    elif f.status == "PRESENT":
        rows = rows.filter(open_sessions=0)

    def finalize(items):
        users = _users_map({r["submitter_id"] for r in items})
        out = []
        for r in items:
            u = users.get(r["submitter_id"])
            worked = r["worked"]
            out.append(
                {
                    **(_emp_fields(u) if u else {"employee_id": r["submitter_id"],
                                                 "employee_name": "", "employee_email": "",
                                                 "department": ""}),
                    "date": r["work_date"].isoformat(),
                    "check_in": r["first_check_in"],
                    "check_out": r["last_check_out"],
                    "worked_seconds": int(worked.total_seconds()) if worked else 0,
                    "worked_hours": round(worked.total_seconds() / 3600, 2) if worked else 0.0,
                    "required_hours": None,
                    "difference_hours": None,
                    "sessions": r["sessions"],
                    "status": "IN_PROGRESS" if r["open_sessions"] else "PRESENT",
                }
            )
        return out

    agg = qs.aggregate(
        total_worked=Sum("worked_duration"),
        total_sessions=Count("id"),
    )
    total_seconds = agg["total_worked"].total_seconds() if agg["total_worked"] else 0
    summary = {
        "total_worked_hours": round(total_seconds / 3600, 2),
        "required_hours": None,
        "attendance_days": rows.count(),
        "employees": rows.values("submitter_id").distinct().count(),
        "sessions": agg["total_sessions"],
        "late_days": None,
        "overtime_hours": None,
        # No schedule/contract data exists in CDS — reported as unavailable,
        # never fabricated.
        "required_hours_available": False,
        "late_days_available": False,
        "overtime_available": False,
    }
    meta = {"report": "attendance", "filters": f.applied}
    return ReportResult(rows=rows, finalize=finalize, summary=summary, meta=meta)


# ---------------------------------------------------------------------------
# 2. Timesheet report — one row per weekly timesheet.
#    CDS business week is Sun–Sat keyed by its Monday (week_start).
# ---------------------------------------------------------------------------

def timesheets_report(user, f):
    qs = scope_items(
        user, Timesheet.objects.select_related("submitter", "submitter__profile")
    )
    if f.employee_id:
        qs = qs.filter(submitter_id=f.employee_id)
    if f.department:
        qs = qs.filter(submitter__profile__department__iexact=f.department)
    if f.date_from:
        qs = qs.filter(week_start__gte=f.date_from)
    if f.date_to:
        qs = qs.filter(week_start__lte=f.date_to)
    if f.status:
        qs = qs.filter(status=f.status)
    rows = qs.annotate(logged=Sum("entries__hours")).order_by("-week_start", "id")

    def finalize(items):
        reviewed = {
            e.item_id: e.created_at
            for e in AuditEntry.objects.filter(
                item_type="timesheet",
                item_id__in=[t.pk for t in items],
                action__in=wf.REVIEW_ACTIONS,
            ).order_by("-created_at")
        }
        out = []
        for t in items:
            logged = t.logged
            # week_start is the Monday inside the Sun–Sat business week.
            out.append(
                {
                    "id": t.pk,
                    **_emp_fields(t.submitter),
                    "week_start": t.week_start.isoformat(),
                    "week_end": (t.week_start + timedelta(days=5)).isoformat(),
                    "business_week_start": (t.week_start - timedelta(days=1)).isoformat(),
                    "logged_hours": round(float(logged), 2) if logged is not None else 0.0,
                    "required_hours": None,
                    "difference_hours": None,
                    "status": t.status,
                    "status_group": STATUS_GROUP[t.status],
                    "current_actor_role": t.current_actor_role,
                    "submitted_at": t.submitted_at,
                    "reviewed_at": reviewed.get(t.pk),
                }
            )
        return out

    # entries join multiplies rows — count distinct timesheets.
    agg = qs.aggregate(
        count=Count("id", distinct=True),
        logged=Sum("entries__hours"),
    )
    by_status = {
        r["status"]: r["n"]
        for r in qs.values("status").annotate(n=Count("id"))
    }
    summary = {
        "timesheets": agg["count"],
        "total_logged_hours": round(float(agg["logged"] or 0), 2),
        "required_hours": None,
        "by_status": by_status,
        "by_status_group": _group_counts(by_status),
        "required_hours_available": False,
    }
    meta = {"report": "timesheets", "filters": f.applied}
    return ReportResult(rows=rows, finalize=finalize, summary=summary, meta=meta)


def _group_counts(by_status):
    groups = {}
    for status, n in by_status.items():
        g = STATUS_GROUP.get(status)
        groups[g] = groups.get(g, 0) + n
    return groups


# ---------------------------------------------------------------------------
# 3. Requests report — one row per request.
# ---------------------------------------------------------------------------

def requests_report(user, f):
    qs = scope_items(
        user,
        Request.objects.select_related(
            "submitter", "submitter__profile", "request_type"
        ),
    )
    if f.employee_id:
        qs = qs.filter(submitter_id=f.employee_id)
    if f.department:
        qs = qs.filter(submitter__profile__department__iexact=f.department)
    if f.date_from:
        qs = qs.filter(submitted_at__date__gte=f.date_from)
    if f.date_to:
        qs = qs.filter(submitted_at__date__lte=f.date_to)
    if f.status:
        qs = qs.filter(status=f.status)
    if f.request_type_id:
        qs = qs.filter(request_type_id=f.request_type_id)
    rows = qs.order_by("-submitted_at", "-id")

    def finalize(items):
        out = []
        for r in items:
            step = wf.current_step(r)
            out.append(
                {
                    "id": r.pk,
                    **_emp_fields(r.submitter),
                    "request_type_id": r.request_type_id,
                    "request_type": r.request_type.name,
                    "created_at": r.submitted_at,
                    "status": r.status,
                    "status_group": STATUS_GROUP[r.status],
                    # Workflow position — the scoped queryset already gates
                    # visibility, so the actor role is shareable here.
                    "current_actor_role": r.current_actor_role,
                    "current_step": r.current_step + 1 if step else None,
                    "total_steps": len(r.workflow_snapshot or []),
                }
            )
        return out

    by_status = {
        r["status"]: r["n"] for r in qs.values("status").annotate(n=Count("id"))
    }
    by_type = {
        r["request_type__name"]: r["n"]
        for r in qs.values("request_type__name").annotate(n=Count("id")).order_by(
            "request_type__name"
        )
    }
    by_type_status = [
        {
            "request_type": r["request_type__name"],
            "status": r["status"],
            "count": r["n"],
        }
        for r in qs.values("request_type__name", "status")
        .annotate(n=Count("id"))
        .order_by("request_type__name", "status")
    ]
    summary = {
        "total": qs.count(),
        "by_status": by_status,
        "by_status_group": _group_counts(by_status),
        "by_request_type": by_type,
        "by_type_status": by_type_status,
    }
    meta = {"report": "requests", "filters": f.applied}
    return ReportResult(rows=rows, finalize=finalize, summary=summary, meta=meta)


# ---------------------------------------------------------------------------
# 4. Employee summary — per-employee consolidated permitted metrics.
# ---------------------------------------------------------------------------

def employees_report(user, f):
    emps = visible_employees(user)
    if f.employee_id:
        emps = emps.filter(pk=f.employee_id)
    if f.department:
        emps = emps.filter(profile__department__iexact=f.department)
    emps = list(emps)
    emp_ids = [u.pk for u in emps]

    att_qs = scope_attendance(user, AttendanceSession.objects.all()).filter(
        submitter_id__in=emp_ids
    )
    if f.date_from:
        att_qs = att_qs.filter(work_date__gte=f.date_from)
    if f.date_to:
        att_qs = att_qs.filter(work_date__lte=f.date_to)
    att = {
        r["submitter_id"]: r
        for r in att_qs.values("submitter_id").annotate(
            days=Count("work_date", distinct=True),
            worked=Sum("worked_duration"),
            sessions=Count("id"),
        )
    }

    ts_qs = scope_items(user, Timesheet.objects.all()).filter(
        submitter_id__in=emp_ids
    )
    if f.date_from:
        ts_qs = ts_qs.filter(week_start__gte=f.date_from)
    if f.date_to:
        ts_qs = ts_qs.filter(week_start__lte=f.date_to)
    ts = {
        r["submitter_id"]: r
        for r in ts_qs.values("submitter_id").annotate(
            count=Count("id", distinct=True),
            logged=Sum("entries__hours"),
            approved=Count("id", filter=Q(status="APPROVED"), distinct=True),
        )
    }

    req_qs = scope_items(user, Request.objects.all()).filter(
        submitter_id__in=emp_ids
    )
    if f.date_from:
        req_qs = req_qs.filter(submitted_at__date__gte=f.date_from)
    if f.date_to:
        req_qs = req_qs.filter(submitted_at__date__lte=f.date_to)
    req = {
        r["submitter_id"]: r
        for r in req_qs.values("submitter_id").annotate(
            total=Count("id"),
            pending=Count("id", filter=Q(status__in=("PENDING", "IN_REVIEW", "RETURNED"))),
            approved=Count("id", filter=Q(status="APPROVED")),
            rejected=Count("id", filter=Q(status="REJECTED")),
            cancelled=Count("id", filter=Q(status="WITHDRAWN")),
        )
    }

    out_rows = []
    for u in emps:
        a, t, r = att.get(u.pk, {}), ts.get(u.pk, {}), req.get(u.pk, {})
        worked = a.get("worked")
        out_rows.append(
            {
                **_emp_fields(u),
                "attendance_days": a.get("days", 0),
                "worked_hours": round(worked.total_seconds() / 3600, 2) if worked else 0.0,
                "sessions": a.get("sessions", 0),
                "timesheets": t.get("count", 0),
                "timesheets_approved": t.get("approved", 0),
                "logged_hours": round(float(t.get("logged") or 0), 2),
                "requests_total": r.get("total", 0),
                "requests_pending": r.get("pending", 0),
                "requests_approved": r.get("approved", 0),
                "requests_rejected": r.get("rejected", 0),
                "requests_cancelled": r.get("cancelled", 0),
            }
        )

    summary = {
        "employees": len(out_rows),
        "attendance_days": sum(r["attendance_days"] for r in out_rows),
        "total_worked_hours": round(sum(r["worked_hours"] for r in out_rows), 2),
        "timesheets": sum(r["timesheets"] for r in out_rows),
        "total_logged_hours": round(sum(r["logged_hours"] for r in out_rows), 2),
        "requests_total": sum(r["requests_total"] for r in out_rows),
        "requests_pending": sum(r["requests_pending"] for r in out_rows),
        "requests_approved": sum(r["requests_approved"] for r in out_rows),
        "requests_rejected": sum(r["requests_rejected"] for r in out_rows),
        "requests_cancelled": sum(r["requests_cancelled"] for r in out_rows),
    }
    meta = {"report": "employees", "filters": f.applied}
    return ReportResult(
        rows=out_rows, finalize=lambda items: items, summary=summary, meta=meta
    )


# ---------------------------------------------------------------------------
# Report registry + scope endpoint data.
# ---------------------------------------------------------------------------

REPORTS = {
    "attendance": {
        "builder": attendance_report,
        "status_choices": ATTENDANCE_STATUSES,
        "allow_request_type": False,
    },
    "timesheets": {
        "builder": timesheets_report,
        "status_choices": ITEM_STATUSES,
        "allow_request_type": False,
    },
    "requests": {
        "builder": requests_report,
        "status_choices": ITEM_STATUSES,
        "allow_request_type": True,
    },
    "employees": {
        "builder": employees_report,
        "status_choices": (),
        "allow_request_type": False,
    },
}


def scope_payload(user):
    """Filter-dropdown data — employees/departments the caller may report on
    and request types relevant to their scoped requests."""
    emps = visible_employees(user)
    scoped_requests = scope_items(user, Request.objects.all())
    types = (
        RequestType.objects.filter(
            Q(is_active=True) | Q(requests__in=scoped_requests)
        )
        .distinct()
        .order_by("name")
    )
    departments = sorted(
        {
            u.profile.department
            for u in emps
            if hasattr(u, "profile") and u.profile.department
        }
    )
    return {
        "employees": [
            {
                "id": u.pk,
                "name": _emp_label(u),
                "email": u.email,
                "department": u.profile.department if hasattr(u, "profile") else "",
                "role": u.role,
            }
            for u in emps
        ],
        "departments": departments,
        "request_types": [{"id": t.pk, "name": t.name} for t in types],
        "can_pick_employee": user.role in ("MANAGER", "HR"),
        "generated_at": timezone.now(),
    }
