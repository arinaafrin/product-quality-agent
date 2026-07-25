from rest_framework import viewsets

from .models import Journey
from .permissions import JourneyPolicy
from .serializers import JourneySerializer


class JourneyViewSet(viewsets.ModelViewSet):
    """
    Index/show public (published only, unless owner/admin). Creating one
    requires partner/admin and auto-dispatches AI generation for every stop
    in a single request (see JourneySerializer.create).
    """

    serializer_class = JourneySerializer
    permission_classes = [JourneyPolicy]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Journey.objects.select_related("city").prefetch_related("stops__experience").all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_admin or user.is_partner)):
            qs = qs.filter(status=Journey.Status.PUBLISHED)
        return qs.order_by("-created_at")
