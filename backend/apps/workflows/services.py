"""Atomic workflow transition engine for requests and timesheets (FR-015–FR-023).

Items implement the protocol: submitter, status, current_step, workflow_snapshot,
current_actor_role, requires_hr_review, AUDIT_ITEM_TYPE.
"""
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.services import record as audit_record
from apps.core.exceptions import Conflict
from apps.notifications.services import emit

from .models import Workflow

PENDING = "PENDING"
IN_REVIEW = "IN_REVIEW"
RETURNED = "RETURNED"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
WITHDRAWN = "WITHDRAWN"

REVIEWABLE = (PENDING, IN_REVIEW)
FINAL = (APPROVED, REJECTED, WITHDRAWN)
ALL_STATUSES = REVIEWABLE + (RETURNED,) + FINAL

REVIEW_ACTIONS = ("approve", "reject", "return")


def has_reviewer_action(item):
    """Whether any reviewer has acted on this item (gates withdrawal/edits)."""
    from apps.audit.models import AuditEntry

    return AuditEntry.objects.filter(
        item_type=item.AUDIT_ITEM_TYPE,
        item_id=item.pk,
        action__in=REVIEW_ACTIONS,
    ).exists()


def is_editable(item):
    """Owner-editable window: returned, or pending before any reviewer action."""
    if item.status == RETURNED:
        return True
    if item.status == PENDING:
        return not has_reviewer_action(item)
    return False


def current_step(item):
    steps = item.workflow_snapshot or []
    return steps[item.current_step] if item.current_step < len(steps) else None


def is_current_actor(item, user):
    """MANAGER step → submitter's *current* manager (live line, FR-018).
    HR step → any active HR user (FR-019)."""
    step = current_step(item)
    if step is None or item.status not in REVIEWABLE:
        return False
    if step["actor_role"] == "MANAGER":
        return item.submitter.manager_id == user.pk
    return user.role == "HR"


def available_actions(item, user):
    actions = []
    if item.submitter_id == user.pk:
        if item.status == RETURNED:
            actions.append("submit")
        elif item.status == PENDING and not has_reviewer_action(item):
            actions.append("withdraw")
    if is_current_actor(item, user):
        actions.extend(REVIEW_ACTIONS)
    return actions


def step_actors(item, step):
    """Users to notify for a given step: manager → live manager; HR → all active HR."""
    from apps.accounts.models import User

    if step["actor_role"] == "MANAGER":
        return [item.submitter.manager] if item.submitter.manager_id else []
    return list(User.objects.filter(role="HR", is_active=True))


def _label(item):
    return item.AUDIT_ITEM_TYPE


@transaction.atomic
def act(item, user, action, comment=None):
    """Perform a review/owner transition. Raises Conflict (409) when not allowed —
    the first recorded transition wins (FR-021)."""
    comment = (comment or "").strip()
    allowed = available_actions(item, user)
    if action not in allowed:
        raise Conflict("This action is not available for the item's current state.")

    step = current_step(item) or {}
    if action == "reject" and step.get("require_comment_on_reject") and not comment:
        raise ValidationError({"comment": "A comment is required to reject."})
    if action == "return" and step.get("require_comment_on_return") and not comment:
        raise ValidationError({"comment": "A comment is required to return."})

    from_status = item.status

    if action == "withdraw":
        item.status = WITHDRAWN
        item.current_actor_role = ""
        notify_targets = []
    elif action == "submit":  # resubmission of a RETURNED item
        item.status = PENDING
        item.current_actor_role = step.get("actor_role", "")
        notify_targets = step_actors(item, step)
    elif action == "approve":
        steps = item.workflow_snapshot or []
        if item.current_step + 1 >= len(steps):
            item.status = APPROVED
            item.current_actor_role = ""
        else:
            item.current_step += 1
            next_step = steps[item.current_step]
            item.status = IN_REVIEW
            item.current_actor_role = next_step["actor_role"]
            notify_targets = step_actors(item, next_step)
        if item.status == APPROVED:
            notify_targets = [item.submitter]
    elif action == "reject":
        item.status = REJECTED
        item.current_actor_role = ""
        notify_targets = [item.submitter]
    else:  # return
        item.status = RETURNED
        item.current_actor_role = ""
        notify_targets = [item.submitter]

    item.save(update_fields=["status", "current_step", "current_actor_role", "updated_at"])
    audit_record(
        item, user, action=action,
        from_status=from_status, to_status=item.status, comment=comment,
    )

    if notify_targets:
        verb = {
            "submit": "resubmitted",
            "approve": "approved" if item.status == APPROVED else "advanced",
            "reject": "rejected",
            "return": "returned",
            "withdraw": "withdrawn",
        }[action]
        if action in ("submit", "approve") and item.status != APPROVED:
            message = f"A {_label(item)} is awaiting your review."
        else:
            message = f"Your {_label(item)} was {verb}."
        emit(notify_targets, item, message, actor=user)
    return item


def default_workflow():
    workflow = (
        Workflow.objects.filter(is_active=True).prefetch_related("steps").order_by("id").first()
    )
    if workflow is None or not workflow.snapshot_steps():
        raise ValidationError("No active workflow is configured.")
    return workflow
