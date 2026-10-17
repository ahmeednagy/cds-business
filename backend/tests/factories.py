import factory
from factory.django import DjangoModelFactory

from apps.accounts.models import EmployeeProfile, User
from apps.attendance.models import AttendanceSession
from apps.requests.models import Request, RequestType
from apps.timesheets.models import Timesheet
from apps.workflows.models import Workflow, WorkflowStep
from apps.workflows import services as wf


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("email",)
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@cdsbusiness.dev")
    role = User.Role.EMPLOYEE
    is_active = True
    must_change_password = False

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "Test!Passw0rd")
        user = model_class(**kwargs)
        user.set_password(password)
        user.save()
        return user

    @factory.post_generation
    def profile(user, create, extracted, **kwargs):
        if create and not hasattr(user, "profile"):
            EmployeeProfile.objects.create(
                user=user,
                first_name=kwargs.get("first_name", "Test"),
                last_name=kwargs.get("last_name", "User"),
            )


class HRUserFactory(UserFactory):
    role = User.Role.HR


class ManagerUserFactory(UserFactory):
    role = User.Role.MANAGER


class WorkflowFactory(DjangoModelFactory):
    class Meta:
        model = Workflow
        skip_postgeneration_save = True

    name = factory.Sequence(lambda n: f"Workflow {n}")


class ManagerWorkflowFactory(WorkflowFactory):
    @factory.post_generation
    def steps(workflow, create, extracted, **kwargs):
        if create and not workflow.steps.exists():
            WorkflowStep.objects.create(workflow=workflow, order=1, actor_role="MANAGER")


class TwoStepWorkflowFactory(WorkflowFactory):
    @factory.post_generation
    def steps(workflow, create, extracted, **kwargs):
        if create and not workflow.steps.exists():
            WorkflowStep.objects.create(
                workflow=workflow, order=1, actor_role="MANAGER"
            )
            WorkflowStep.objects.create(workflow=workflow, order=2, actor_role="HR")


class RequestTypeFactory(DjangoModelFactory):
    class Meta:
        model = RequestType

    name = factory.Sequence(lambda n: f"Type {n}")
    workflow = factory.SubFactory(ManagerWorkflowFactory)
    fields_schema = factory.LazyFunction(
        lambda: [{"key": "reason", "label": "Reason", "type": "text", "required": True}]
    )


class RequestFactory(DjangoModelFactory):
    class Meta:
        model = Request

    request_type = factory.SubFactory(RequestTypeFactory)
    submitter = factory.SubFactory(UserFactory)
    values = factory.LazyFunction(lambda: {"reason": "Testing"})

    @factory.lazy_attribute
    def workflow_snapshot(self):
        return self.request_type.workflow.snapshot_steps()

    @factory.lazy_attribute
    def current_actor_role(self):
        return self.workflow_snapshot[0]["actor_role"] if self.workflow_snapshot else ""

    @factory.lazy_attribute
    def requires_hr_review(self):
        return any(s["actor_role"] == "HR" for s in self.workflow_snapshot)


class AttendanceSessionFactory(DjangoModelFactory):
    class Meta:
        model = AttendanceSession

    submitter = factory.SubFactory(UserFactory)
    work_date = factory.LazyFunction(
        lambda: __import__("django.utils.timezone", fromlist=["now"]).localdate()
    )
    check_in_at = factory.LazyFunction(
        lambda: __import__("django.utils.timezone", fromlist=["now"]).now()
    )


class TimesheetFactory(DjangoModelFactory):
    class Meta:
        model = Timesheet

    submitter = factory.SubFactory(UserFactory)
    week_start = factory.Sequence(lambda n: __import__("datetime").date(2024, 1, 1) + __import__("datetime").timedelta(weeks=n))

    @factory.lazy_attribute
    def workflow_snapshot(self):
        workflow = wf.default_workflow()
        return workflow.snapshot_steps()

    @factory.lazy_attribute
    def current_actor_role(self):
        return self.workflow_snapshot[0]["actor_role"] if self.workflow_snapshot else ""

    @factory.lazy_attribute
    def requires_hr_review(self):
        return any(s["actor_role"] == "HR" for s in self.workflow_snapshot)
