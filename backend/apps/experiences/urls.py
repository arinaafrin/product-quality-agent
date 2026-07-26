from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=False)
router.register("experiences", views.ExperienceViewSet, basename="experience")

urlpatterns = [
    path(
        "experiences/<uuid:experience_id>/media",
        views.ExperienceMediaView.as_view(),
        name="experience-media",
    ),
    path(
        "experiences/<uuid:experience_id>/favorite",
        views.FavoriteToggleView.as_view(),
        name="experience-favorite",
    ),
    path("me/favorites", views.FavoriteListView.as_view(), name="my-favorites"),
] + router.urls
