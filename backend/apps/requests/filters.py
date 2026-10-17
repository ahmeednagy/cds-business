import django_filters
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from .models import Request


class _DateRangeValidationMixin:
    """Inverted ranges → 400 validation_error (C4 remediation). FilterSet has no
    clean() lifecycle — validation hooks into is_valid, which DRF's backend calls."""

    _range_fields = ()

    def is_valid(self):
        valid = super().is_valid()
        if not valid:
            return False
        for start_field, end_field in self._range_fields:
            start = self.form.cleaned_data.get(start_field)
            end = self.form.cleaned_data.get(end_field)
            if start and end and end < start:
                raise ValidationError(
                    {end_field: f"Must be on or after {start_field}."}
                )
        return True


class RequestFilter(_DateRangeValidationMixin, django_filters.FilterSet):
    _range_fields = (("date_from", "date_to"),)
    status = django_filters.ChoiceFilter(choices=Request.STATUS_CHOICES)
    request_type = django_filters.NumberFilter(field_name="request_type_id")
    submitter = django_filters.NumberFilter(field_name="submitter_id")
    date_from = django_filters.DateFilter(field_name="submitted_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="submitted_at", lookup_expr="date__lte")
    pending_review = django_filters.BooleanFilter(method="filter_pending_review")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Request
        fields = ["status", "request_type", "submitter", "date_from", "date_to"]

    def filter_pending_review(self, qs, name, value):
        if not value:
            return qs
        from apps.core.permissions import queue_items

        return queue_items(self.request.user, qs)

    def filter_search(self, qs, name, value):
        # Type name, submitter identity, or the current reviewer role — all on
        # the already role-scoped queryset (no visibility widening).
        return qs.filter(
            Q(request_type__name__icontains=value)
            | Q(submitter__email__icontains=value)
            | Q(submitter__profile__first_name__icontains=value)
            | Q(submitter__profile__last_name__icontains=value)
            | Q(current_actor_role__icontains=value)
        )
