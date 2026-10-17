from .base import *  # noqa: F401,F403

DEBUG = True
SECRET_KEY = "dev-secret-key-for-local-development-only"

# base.py computes this before dev.py overrides DEBUG — drop Secure so the
# refresh cookie is stored over plain HTTP on non-localhost dev hosts too.
REFRESH_COOKIE_KWARGS = {**REFRESH_COOKIE_KWARGS, "secure": False}
