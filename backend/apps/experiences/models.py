from django.conf import settings
from django.db import models

from apps.cities.models import City
from apps.common.models import BaseModel


class Experience(BaseModel):
    """A single point-in-time 'time capsule': a city + year + AI-generated story/media."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        ARCHIVED = "archived", "Archived"

    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="experiences")
    year = models.IntegerField()
    era_label = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_experiences",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_experiences",
    )
    google_maps_link = models.CharField(max_length=500, null=True, blank=True)

    # Resolved server-side from google_maps_link via GoogleMapsService.resolve_link().
    # Nullable because the link is optional and resolution can fail (dead
    # link, unsupported format, API quota) without blocking creation.
    pin_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    pin_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    pin_place_name = models.CharField(max_length=255, null=True, blank=True)

    favorited_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="Favorite", related_name="favorites"
    )

    class Meta:
        indexes = [
            models.Index(fields=["city", "year"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.city.name} ({self.year})"


class MediaAsset(BaseModel):
    class Type(models.TextChoices):
        PANORAMA_360 = "panorama_360", "360 panorama"
        STILL_IMAGE = "still_image", "Still image"
        THUMBNAIL = "thumbnail", "Thumbnail"
        MODEL_3D = "3d_model", "3D model"

    class SourceType(models.TextChoices):
        AI_GENERATED = "ai_generated", "AI generated"
        ARCHIVAL = "archival", "Archival"
        PARTNER_UPLOAD = "partner_upload", "Partner upload"

    experience = models.ForeignKey(
        Experience, on_delete=models.CASCADE, related_name="media_assets"
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    storage_path = models.CharField(max_length=500)
    signed_url_expiry_seconds = models.PositiveIntegerField(default=900)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    attribution_text = models.CharField(max_length=500, null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["experience", "type"])]


class Favorite(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_links"
    )
    experience = models.ForeignKey(
        Experience, on_delete=models.CASCADE, related_name="favorite_links"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "experience"], name="unique_user_experience_favorite"
            )
        ]
