"""JWT auth for WebSockets.

Browsers can't set Authorization headers on WS handshakes, so the access
token travels as `?token=` — same SimpleJWT validation as the HTTP API,
including the deactivated-account rejection.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _user_for_token(raw):
    from apps.accounts.models import User

    try:
        token = AccessToken(raw)
        user = User.objects.get(pk=token["user_id"], is_active=True)
    except Exception:
        return AnonymousUser()
    return user


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        raw = (query.get("token") or [None])[0]
        scope["user"] = (
            await _user_for_token(raw) if raw else AnonymousUser()
        )
        return await super().__call__(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)
