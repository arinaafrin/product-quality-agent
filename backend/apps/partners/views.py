from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsPartnerOrAdmin

from .models import PartnerOrganization
from .serializers import PartnerOrganizationSerializer


class PartnerOrganizationViewSet(viewsets.ModelViewSet):
    queryset = PartnerOrganization.objects.all()
    serializer_class = PartnerOrganizationSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        if self.action == "verify":
            return [IsAdmin()]
        return [IsPartnerOrAdmin()]

    @action(detail=True, methods=["post"], url_path="verify")
    def verify(self, request, pk=None):
        partner = self.get_object()
        partner.verified = True
        partner.save(update_fields=["verified", "updated_at"])
        return Response(PartnerOrganizationSerializer(partner).data)
