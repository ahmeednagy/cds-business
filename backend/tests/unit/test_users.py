"""User model unit tests — roles, reporting line integrity."""
import pytest
from django.core.exceptions import ValidationError

from apps.accounts.models import User
from tests.factories import ManagerUserFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_email_is_login_identifier():
    user = UserFactory(email="ident@cdsbusiness.dev")
    assert user.USERNAME_FIELD == "email"
    assert User.objects.get(email="ident@cdsbusiness.dev") == user


def test_exactly_three_roles():
    assert {r for r, _ in User.Role.choices} == {"EMPLOYEE", "MANAGER", "HR"}


def test_manager_cycle_rejected():
    manager = ManagerUserFactory()
    employee = UserFactory(manager=manager)
    manager.manager = employee
    with pytest.raises(ValidationError):
        manager.save()


def test_self_manager_rejected():
    user = UserFactory()
    user.manager = user
    with pytest.raises(ValidationError):
        user.save()


def test_deactivation_does_not_delete():
    user = UserFactory()
    user.is_active = False
    user.save()
    assert User.objects.filter(pk=user.pk).exists()
