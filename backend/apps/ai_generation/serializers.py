from rest_framework import serializers

from .models import AiGenerationJob, StoryContent


class StoryContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoryContent
        fields = [
            "id",
            "experience",
            "narrative_script",
            "description",
            "audio_narration_url",
            "ai_model_used",
            "estimated_duration_seconds",
        ]
        read_only_fields = fields


class AiGenerationJobSerializer(serializers.ModelSerializer):
    story_content = serializers.SerializerMethodField()

    class Meta:
        model = AiGenerationJob
        fields = [
            "id",
            "experience",
            "requested_by",
            "status",
            "job_type",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
            "story_content",
        ]
        read_only_fields = fields

    def get_story_content(self, job):
        story = getattr(job.experience, "story_content", None)
        return StoryContentSerializer(story).data if story else None
