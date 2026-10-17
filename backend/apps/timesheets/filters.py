import django_filters

from apps.requests.filters import _DateRangeValidationMixin

from .models import Timesheet


class TimesheetFilter(_DateRangeValidationMixin, django_filters.FilterSet):
    _range_fields = (("week_from", "week_to"),)
    status = django_filters.ChoiceFilter(choices=Timesheet.STATUS_CHOICES)
    submitter = django_filters.NumberFilter(field_name="submitter_id")
    week_from = django_filters.DateFilter(field_name="week_start", lookup_expr="gte")
    week_to = django_filters.DateFilter(field_name="week_start", lookup_expr="lte")
    pending_review = django_filters.BooleanFilter(method="filter_pending_review")

    class Meta:
        model = Timesheet
        fields = ["status", "submitter", "week_from", "week_to"]

    def filter_pending_review(self, qs, name, value):
        if not value:
            return qs
        from apps.core.permissions import queue_items

        return queue_items(self.request.user, qs)
