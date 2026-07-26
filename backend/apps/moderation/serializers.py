from rest_framework import serializers

from apps.experiences.serializers import ExperienceSerializer

from .models import ModerationLog


class ModerationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModerationLog
        fields = ["id", "experience", "reviewer", "action", "notes", "created_at"]
        read_only_fields = ["id", "reviewer", "action", "created_at"]


class ModerationQueueSerializer(ExperienceSerializer):
    """Same shape as ExperienceSerializer; kept as its own class so the
    moderation queue's response shape can diverge later without touching
    the public ExperienceSerializer."""
