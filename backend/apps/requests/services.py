"""Request domain services: schema validation + submission/resubmission."""
from datetime import date

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.audit.services import record as audit_record
from apps.notifications.services import emit
from apps.workflows import services as wf

from .models import Request


def validate_values(schema, values):
    """Validate submitted values against the request type's fields_schema (FR-013)."""
    if not isinstance(values, dict):
        raise ValidationError({"values": "Must be an object keyed by field name."})
    errors = {}
    known = {f["key"]: f for f in schema}
    for key in values:
        if key not in known:
            errors[key] = "Unknown field."
    for field in schema:
        key = field["key"]
        value = values.get(key)
        if field.get("required") and (value is None or value == ""):
            errors[key] = "This field is required."
            continue
        if value is None or key not in values:
            continue
        ftype = field.get("type", "text")
        if ftype == "number" and not isinstance(value, (int, float)):
            errors[key] = "Must be a number."
        elif ftype == "date":
            try:
                date.fromisoformat(str(value))
            except ValueError:
                errors[key] = "Must be an ISO date (YYYY-MM-DD)."
        elif ftype == "choice" and value not in field.get("choices", []):
            errors[key] = "Must be one of the allowed choices."
    if errors:
        raise ValidationError({"values": errors})


def _apply_snapshot(item, request_type):
    steps = request_type.workflow.snapshot_steps()
    if not steps:
        raise ValidationError("The request type's workflow has no steps.")
    item.workflow_snapshot = steps
    item.current_step = 0
    item.current_actor_role = steps[0]["actor_role"]
    item.requires_hr_review = any(s["actor_role"] == "HR" for s in steps)


@transaction.atomic
def submit_request(user, request_type, values, comment=""):
    validate_values(request_type.fields_schema, values)
    item = Request(request_type=request_type, submitter=user, values=values, comment=comment)
    _apply_snapshot(item, request_type)
    item.save()
    audit_record(item, user, action="submit", to_status=item.status, comment=comment)
    step = wf.current_step(item)
    if step:
        emit(wf.step_actors(item, step), item, "A request is awaiting your review.", actor=user)
    return item


@transaction.atomic
def resubmit_request(item, user, values=None, comment=""):
    if item.submitter_id != user.pk:
        raise ValidationError("Only the submitter can resubmit.")
    if values is not None:
        validate_values(item.request_type.fields_schema, values)
        item.values = values
        item.save(update_fields=["values", "updated_at"])
    return wf.act(item, user, "submit", comment=comment)
