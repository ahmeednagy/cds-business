"""Base settings for CDS Business HR platform."""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BASE_DIR.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    # Daphne first: provides the ASGI-enabled `runserver` command override.
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    "apps.core",
    "apps.accounts",
    "apps.workflows",
    "apps.requests",
    "apps.timesheets",
    "apps.attendance",
    "apps.notifications",
    "apps.audit",
    "apps.reports",
    "channels",
    "apps.chat",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Dev channel layer — single-process dev server only. Production/multi-process
# must set CHANNEL_LAYERS to channels_redis with a real Redis URL.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": os.environ.get(
            "CHANNEL_LAYER_BACKEND", "channels.layers.InMemoryChannelLayer"
        ),
        **(
            {"CONFIG": {"hosts": [os.environ["CHANNEL_LAYER_REDIS_URL"]]}}
            if os.environ.get("CHANNEL_LAYER_REDIS_URL")
            else {}
        ),
    }
}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# Cross-origin controls — empty by default (same-origin APIs need no CORS).
# Set in production, e.g. CORS_ALLOWED_ORIGINS=https://app.example.com
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

# DATABASE_URL takes precedence when set (Render/Neon style
# postgresql://user:pass@host/db?sslmode=require); otherwise the DB_*
# variables below keep the local Docker Postgres / sqlite defaults working.
_database_url = os.environ.get("DATABASE_URL", "").strip()
if _database_url:
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.parse(
            _database_url, conn_max_age=600, conn_health_checks=True
        )
    }
    # Managed Postgres (Neon et al.) requires SSL; don't force it for
    # localhost-style URLs that deliberately omit sslmode.
    _is_remote = not any(
        h in _database_url for h in ("localhost", "127.0.0.1", "@db:", "@db/")
    )
    if _is_remote and "sslmode" not in _database_url:
        DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"
else:
    DATABASES = {
        "default": {
            "ENGINE": os.environ.get("DB_ENGINE", "django.db.backends.sqlite3"),
            "NAME": os.environ.get("DB_NAME", BASE_DIR / "db.sqlite3"),
            "USER": os.environ.get("DB_USER", ""),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", ""),
            "PORT": os.environ.get("DB_PORT", ""),
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
# Business timezone — all "today"/work-date derivation (attendance check-in,
# timesheets, dashboard, reports) resolves against Cairo local time while
# timestamps stay stored as aware UTC in the database.
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Private attachment storage — never served by Nginx (constitution V).
MEDIA_ROOT = REPO_ROOT / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "apps.core.permissions.IsAuthenticatedAndPasswordFresh",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
    "DEFAULT_THROTTLE_RATES": {"login": "10/minute", "password_reset": "5/hour"},
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Self-service password reset: stateless signed tokens (PasswordResetTokenGenerator)
# — expire after 1h and auto-invalidate once the password changes (single-use).
PASSWORD_RESET_TIMEOUT = 3600
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

# Dev/test-safe default: emails print to the console. In production set
# EMAIL_BACKEND/EMAIL_HOST/… env vars to a real SMTP backend.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@cds-business.local")

# Seconds a call rings before the server finalizes it as MISSED.
CHAT_RING_TIMEOUT_SECONDS = int(
    os.environ.get("CHAT_RING_TIMEOUT_SECONDS", "30")
)

REFRESH_COOKIE_NAME = "cds_refresh"
REFRESH_COOKIE_KWARGS = {
    "httponly": True,
    "secure": not DEBUG,
    "samesite": "Lax",
    "path": "/api/auth/",
}

ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024
ATTACHMENT_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}
ATTACHMENT_ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".txt"}
