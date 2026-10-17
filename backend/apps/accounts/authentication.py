from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication as BaseJWTAuth


class JWTAuthentication(BaseJWTAuth):
    """Rejects tokens for deactivated accounts at the auth layer (FR-045 edge)."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active:
            raise AuthenticationFailed("Account is deactivated.")
        return user
