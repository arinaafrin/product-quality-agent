"""
Combines every app's routes under one /api/v1/ namespace. Each Django app
owns its own urls.py, same idea as Laravel's routes/api.php grouping by
controller, just split by domain instead of one big file.
"""

from django.http import JsonResponse
from django.urls import include, path

from apps.accounts.urls import me_urlpatterns


def ping(request):
    return JsonResponse({"service": "timecapsule-api", "status": "ok"})


urlpatterns = [
    path("ping", ping, name="ping"),
    path("auth/", include("apps.accounts.urls")),
    *me_urlpatterns,
    path("", include("apps.cities.urls")),
    path("", include("apps.experiences.urls")),
    path("", include("apps.ai_generation.urls")),
    path("", include("apps.moderation.urls")),
    path("", include("apps.journeys.urls")),
    path("", include("apps.partners.urls")),
]
