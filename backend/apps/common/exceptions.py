from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """
    Wraps DRF's default exception handler so every error response has the
    same predictable shape: {"error": {"detail": ..., "code": ...}}.
    """
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {
            "error": {
                "detail": response.data,
                "code": response.status_code,
            }
        }
    return response


class DomainError(Exception):
    """Base class for business-rule violations raised inside services.py files."""


class RateLimitExceeded(DomainError):
    """Raised when a user exceeds the AI generation rate limit."""
