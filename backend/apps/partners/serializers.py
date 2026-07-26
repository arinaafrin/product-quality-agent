from rest_framework import serializers

from .models import PartnerOrganization


class PartnerOrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerOrganization
        fields = ["id", "name", "contact_user", "verified", "created_at"]
        read_only_fields = ["id", "verified", "created_at"]
