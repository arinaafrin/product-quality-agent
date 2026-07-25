from django.urls import path

from . import views

urlpatterns = [
    path(
        "experiences/<uuid:experience_id>/generate",
        views.GenerateStoryView.as_view(),
        name="generate-story",
    ),
    path(
        "experiences/<uuid:experience_id>/generate-media",
        views.GenerateMediaView.as_view(),
        name="generate-media",
    ),
    path("ai-jobs/<uuid:job_id>", views.AiGenerationJobDetailView.as_view(), name="ai-job-detail"),
]
