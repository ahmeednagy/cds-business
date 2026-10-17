from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "The action conflicts with the current state."
    default_code = "conflict"


_CODE_BY_STATUS = {
    400: "validation_error",
    401: "unauthenticated",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "throttled",
}


def _code_for(response) -> str:
    return _CODE_BY_STATUS.get(response.status_code, "error")


def _first_message(data) -> str:
    if isinstance(data, dict):
        for value in data.values():
            return _first_message(value)
    if isinstance(data, list) and data:
        return _first_message(data[0])
    return str(data)


def exception_handler(exc, context):
    """Uniform error envelope: {error: {code, message, details?}} — no internals (FR-041)."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    response.data = {
        "error": {
            "code": _code_for(response),
            "message": _first_message(response.data),
            "details": response.data,
        }
    }
    return response
