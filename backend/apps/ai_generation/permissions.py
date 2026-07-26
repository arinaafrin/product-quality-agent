"""
Throttles AI generation endpoints — the Python equivalent of Laravel's
`ai.rate_limit` route middleware. Implemented as a DRF permission class
(not Django middleware) because JWT authentication only resolves
`request.user` inside DRF's request cycle, not in raw Django middleware.
"""

from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import BasePermission


class AiRateLimitPermission(BasePermission):
    message = "AI generation rate limit exceeded. Try again later."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        cache_key = f"ai_rate_limit:{user.id}"
        count = cache.get(cache_key, 0)
        if count >= settings.AI_GENERATION_RATE_LIMIT_PER_HOUR:
            return False
        cache.set(cache_key, count + 1, timeout=3600)
        return True
