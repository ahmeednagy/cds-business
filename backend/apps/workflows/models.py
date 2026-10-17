from django.db import models

from apps.core.models import TimeStampedModel


class Workflow(TimeStampedModel):
    AUDIT_ITEM_TYPE = "workflow"

    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    def snapshot_steps(self):
        """Immutable copy of step config captured at item submission (FR-022)."""
        return [
            {
                "order": step.order,
                "actor_role": step.actor_role,
                "require_comment_on_reject": step.require_comment_on_reject,
                "require_comment_on_return": step.require_comment_on_return,
            }
            for step in self.steps.order_by("order")
        ]

    def __str__(self):
        return self.name


class WorkflowStep(models.Model):
    class ActorRole(models.TextChoices):
        MANAGER = "MANAGER", "Manager"
        HR = "HR", "HR"

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveSmallIntegerField()
    actor_role = models.CharField(max_length=8, choices=ActorRole.choices)
    require_comment_on_reject = models.BooleanField(default=True)
    require_comment_on_return = models.BooleanField(default=True)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["workflow", "order"], name="unique_step_order_per_workflow"
            )
        ]

    def __str__(self):
        return f"{self.workflow.name} step {self.order}: {self.actor_role}"
