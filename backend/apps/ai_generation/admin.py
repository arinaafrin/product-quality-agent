from django.contrib import admin

from .models import AiGenerationJob, StoryContent


@admin.register(AiGenerationJob)
class AiGenerationJobAdmin(admin.ModelAdmin):
    list_display = ["experience", "job_type", "status", "requested_by", "created_at"]
    list_filter = ["status", "job_type"]


@admin.register(StoryContent)
class StoryContentAdmin(admin.ModelAdmin):
    list_display = ["experience", "ai_model_used", "estimated_duration_seconds"]
