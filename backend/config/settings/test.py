from .base import *  # noqa: F401,F403

DEBUG = False
SECRET_KEY = "test-secret-key"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
MEDIA_ROOT = BASE_DIR / "test_media"  # noqa: F405

DATABASES["default"] = {  # noqa: F405
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": ":memory:",
}

# Login throttle exists to slow credential guessing, not test runs.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "login": "100000/minute",
    "password_reset": "100000/minute",
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
