from django.contrib.auth import get_user_model
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai_generation.models import AiGenerationJob
from apps.cities.models import City
from apps.common.permissions import IsAdmin
from apps.experiences.models import Experience

from .models import ModerationLog
from .serializers import ModerationLogSerializer, ModerationQueueSerializer

User = get_user_model()


class ModerationQueueView(generics.ListAPIView):
    """GET /moderation/queue — experiences awaiting review, admin-only."""

    serializer_class = ModerationQueueSerializer
    permission_classes = [IsAdmin]
    queryset = Experience.objects.filter(status=Experience.Status.PENDING_REVIEW).select_related(
        "city"
    )


class ModerationActionView(APIView):
    """
    Shared base for approve/reject/comment — each writes a ModerationLog
    entry and (for approve/reject) updates the Experience status.
    """

    permission_classes = [IsAdmin]
    action_name: str = ""
    new_status: str | None = None

    def post(self, request, experience_id):
        experience = Experience.objects.get(pk=experience_id)
        if self.new_status:
            experience.status = self.new_status
            if self.new_status == Experience.Status.APPROVED:
                experience.approved_by = request.user
            experience.save(update_fields=["status", "approved_by", "updated_at"])

        log = ModerationLog.objects.create(
            experience=experience,
            reviewer=request.user,
            action=self.action_name,
            notes=request.data.get("notes"),
        )
        return Response(ModerationLogSerializer(log).data)


class ApproveView(ModerationActionView):
    action_name = ModerationLog.Action.APPROVED
    new_status = Experience.Status.APPROVED


class RejectView(ModerationActionView):
    action_name = ModerationLog.Action.REJECTED
    new_status = Experience.Status.REJECTED


class CommentView(ModerationActionView):
    action_name = ModerationLog.Action.COMMENT
    new_status = None


class AdminStatsView(APIView):
    """GET /admin/stats — platform-wide counts + recent activity, admin-only."""

    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(
            {
                "counts": {
                    "users": User.objects.count(),
                    "cities": City.objects.count(),
                    "experiences": Experience.objects.count(),
                    "experiences_pending_review": Experience.objects.filter(
                        status=Experience.Status.PENDING_REVIEW
                    ).count(),
                    "ai_jobs_queued": AiGenerationJob.objects.filter(
                        status=AiGenerationJob.Status.QUEUED
                    ).count(),
                },
                "recent_moderation_activity": ModerationLogSerializer(
                    ModerationLog.objects.select_related("experience", "reviewer")[:10], many=True
                ).data,
            }
        )


class ModerationLogListView(generics.ListAPIView):
    """GET /moderation/{experience}/logs"""

    serializer_class = ModerationLogSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return ModerationLog.objects.filter(experience_id=self.kwargs["experience_id"])
