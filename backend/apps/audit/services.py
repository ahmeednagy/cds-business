from .models import AuditEntry


def record(item, actor, action, from_status=None, to_status=None, comment=""):
    """Write an audit record — always called inside the mutation's transaction."""
    return AuditEntry.objects.create(
        actor=actor,
        action=action,
        item_type=item.AUDIT_ITEM_TYPE,
        item_id=item.pk,
        from_status=from_status,
        to_status=to_status,
        comment=comment or "",
    )
