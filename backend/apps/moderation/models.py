from django.conf import settings
from django.db import models

from apps.common.models import BaseModel
from apps.experiences.models import Experience


class ModerationLog(BaseModel):
    class Action(models.TextChoices):
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        COMMENT = "comment", "Comment"

    experience = models.ForeignKey(
        Experience, on_delete=models.CASCADE, related_name="moderation_logs"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="moderation_logs"
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["experience", "created_at"])]
        ordering = ["-created_at"]
