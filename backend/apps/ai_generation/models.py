from django.conf import settings
from django.db import models

from apps.common.models import BaseModel
from apps.experiences.models import Experience


class AiGenerationJob(BaseModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class JobType(models.TextChoices):
        STORY_TEXT = "story_text", "Story text"
        IMAGE = "image", "Image"
        FULL_BUNDLE = "full_bundle", "Full bundle"

    experience = models.ForeignKey(Experience, on_delete=models.CASCADE, related_name="ai_jobs")
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_jobs"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    job_type = models.CharField(max_length=20, choices=JobType.choices, default=JobType.STORY_TEXT)
    error_message = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["experience", "status"])]


class StoryContent(BaseModel):
    experience = models.OneToOneField(
        Experience, on_delete=models.CASCADE, related_name="story_content"
    )
    narrative_script = models.TextField()
    description = models.TextField()
    audio_narration_url = models.CharField(max_length=500, null=True, blank=True)
    ai_model_used = models.CharField(max_length=255, null=True, blank=True)
    generation_prompt_hash = models.CharField(max_length=255, null=True, blank=True)
    estimated_duration_seconds = models.PositiveIntegerField(default=300)
