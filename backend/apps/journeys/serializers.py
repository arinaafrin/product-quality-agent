from rest_framework import serializers

from apps.experiences.models import Experience
from apps.experiences.serializers import ExperienceSerializer

from .models import Journey, JourneyStop


class JourneyStopSerializer(serializers.ModelSerializer):
    experience_detail = ExperienceSerializer(source="experience", read_only=True)

    class Meta:
        model = JourneyStop
        fields = [
            "id",
            "experience",
            "experience_detail",
            "sequence_order",
            "stop_latitude",
            "stop_longitude",
        ]
        read_only_fields = ["id"]


class JourneyStopInputSerializer(serializers.Serializer):
    """Input-only shape for creating a stop inline when creating a Journey."""

    city_id = serializers.UUIDField()
    year = serializers.IntegerField()
    era_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sequence_order = serializers.IntegerField()
    stop_latitude = serializers.DecimalField(
        max_digits=10, decimal_places=7, required=False, allow_null=True
    )
    stop_longitude = serializers.DecimalField(
        max_digits=10, decimal_places=7, required=False, allow_null=True
    )


class JourneySerializer(serializers.ModelSerializer):
    stops = JourneyStopSerializer(many=True, read_only=True)
    # Write-only: list of {city_id, year, era_label, sequence_order, ...}
    # used only on create — each dispatches its own AI generation job.
    new_stops = JourneyStopInputSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Journey
        fields = [
            "id",
            "title",
            "description",
            "city",
            "created_by",
            "status",
            "stops",
            "new_stops",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "status", "created_at", "updated_at"]

    def create(self, validated_data):
        from apps.ai_generation.models import AiGenerationJob
        from apps.ai_generation.tasks import generate_story_task

        stops_data = validated_data.pop("new_stops", [])
        request = self.context["request"]
        validated_data["created_by"] = request.user
        journey = Journey.objects.create(**validated_data)

        for stop_data in stops_data:
            experience = Experience.objects.create(
                city_id=stop_data["city_id"],
                year=stop_data["year"],
                era_label=stop_data.get("era_label"),
                created_by=request.user,
            )
            JourneyStop.objects.create(
                journey=journey,
                experience=experience,
                sequence_order=stop_data["sequence_order"],
                stop_latitude=stop_data.get("stop_latitude"),
                stop_longitude=stop_data.get("stop_longitude"),
            )
            job = AiGenerationJob.objects.create(
                experience=experience,
                requested_by=request.user,
                job_type=AiGenerationJob.JobType.STORY_TEXT,
            )
            generate_story_task.delay(str(job.id))

        return journey
