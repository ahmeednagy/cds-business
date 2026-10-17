import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    """Return a client bound to a user via force_authenticate."""
    def _for(user):
        api_client.force_authenticate(user=user)
        return api_client

    return _for


@pytest.fixture(autouse=True)
def _media_tmp(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
