from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.experiences.models import Experience

from .models import AiGenerationJob
from .permissions import AiRateLimitPermission
from .serializers import AiGenerationJobSerializer
from .tasks import generate_media_task, generate_story_task


class GenerateStoryView(APIView):
    """POST /experiences/{id}/generate — queues a story-generation job."""

    permission_classes = [IsAuthenticated, AiRateLimitPermission]

    def post(self, request, experience_id):
        experience = Experience.objects.get(pk=experience_id)
        job = AiGenerationJob.objects.create(
            experience=experience,
            requested_by=request.user,
            job_type=AiGenerationJob.JobType.STORY_TEXT,
        )
        generate_story_task.delay(str(job.id))
        return Response(AiGenerationJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class GenerateMediaView(APIView):
    """POST /experiences/{id}/generate-media — queues an image/media-generation job."""

    permission_classes = [IsAuthenticated, AiRateLimitPermission]

    def post(self, request, experience_id):
        experience = Experience.objects.get(pk=experience_id)
        job = AiGenerationJob.objects.create(
            experience=experience,
            requested_by=request.user,
            job_type=AiGenerationJob.JobType.IMAGE,
        )
        generate_media_task.delay(str(job.id))
        return Response(AiGenerationJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class AiGenerationJobDetailView(generics.RetrieveAPIView):
    """GET /ai-jobs/{id} — poll job status."""

    serializer_class = AiGenerationJobSerializer
    permission_classes = [IsAuthenticated]
    queryset = AiGenerationJob.objects.select_related("experience")
    lookup_url_kwarg = "job_id"
