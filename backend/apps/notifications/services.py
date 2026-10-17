from .models import Notification


def emit(recipients, item, message, actor=None):
    """Create notifications, skipping the actor's own action (FR-034)."""
    if recipients is None:
        return
    if not isinstance(recipients, (list, tuple, set)):
        recipients = [recipients]
    for recipient in set(r for r in recipients if r is not None):
        if actor is not None and recipient.pk == actor.pk:
            continue
        Notification.objects.create(
            recipient=recipient,
            item_type=item.AUDIT_ITEM_TYPE,
            item_id=item.pk,
            message=message[:255],
        )
