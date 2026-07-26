from rest_framework import serializers

from apps.cities.serializers import CitySerializer

from .models import Experience, Favorite, MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "experience",
            "type",
            "storage_path",
            "signed_url_expiry_seconds",
            "source_type",
            "attribution_text",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ExperienceSerializer(serializers.ModelSerializer):
    city_detail = CitySerializer(source="city", read_only=True)

    class Meta:
        model = Experience
        fields = [
            "id",
            "city",
            "city_detail",
            "year",
            "era_label",
            "status",
            "created_by",
            "approved_by",
            "google_maps_link",
            "pin_latitude",
            "pin_longitude",
            "pin_place_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "pin_latitude",
            "pin_longitude",
            "pin_place_name",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class FavoriteSerializer(serializers.ModelSerializer):
    experience_detail = ExperienceSerializer(source="experience", read_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "experience", "experience_detail", "created_at"]
        read_only_fields = ["id", "created_at"]
