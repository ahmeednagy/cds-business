from rest_framework import serializers

from .models import Workflow, WorkflowStep


class WorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStep
        fields = ["id", "order", "actor_role", "require_comment_on_reject", "require_comment_on_return"]


class WorkflowSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True)

    class Meta:
        model = Workflow
        fields = ["id", "name", "is_active", "steps", "created_at", "updated_at"]


class WorkflowWriteSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True)

    class Meta:
        model = Workflow
        fields = ["id", "name", "is_active", "steps"]

    def validate_steps(self, steps):
        if not steps:
            raise serializers.ValidationError("A workflow needs at least one step.")
        orders = [s["order"] for s in steps]
        if len(orders) != len(set(orders)):
            raise serializers.ValidationError("Step orders must be unique.")
        return steps

    def create(self, validated_data):
        steps = validated_data.pop("steps")
        workflow = Workflow.objects.create(**validated_data)
        WorkflowStep.objects.bulk_create(
            [WorkflowStep(workflow=workflow, **step) for step in steps]
        )
        return workflow

    def update(self, instance, validated_data):
        steps = validated_data.pop("steps", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if steps is not None:
            # In-flight items use their snapshot, so rewriting steps is safe (FR-022).
            instance.steps.all().delete()
            WorkflowStep.objects.bulk_create(
                [WorkflowStep(workflow=instance, **step) for step in steps]
            )
        return instance
