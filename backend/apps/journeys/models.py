from django.conf import settings
from django.db import models

from apps.cities.models import City
from apps.common.models import BaseModel
from apps.experiences.models import Experience


class Journey(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending review"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    city = models.ForeignKey(City, on_delete=models.CASCADE, related_name="journeys")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="journeys"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    def __str__(self):
        return self.title


class JourneyStop(BaseModel):
    # A themed, ordered collection of stops — each stop reuses the existing
    # Experience model + AI generation pipeline unchanged.
    journey = models.ForeignKey(Journey, on_delete=models.CASCADE, related_name="stops")
    experience = models.ForeignKey(
        Experience, on_delete=models.CASCADE, related_name="journey_stops"
    )
    sequence_order = models.PositiveIntegerField(default=0)
    # Nullable: a stop may reuse the journey's overall city location, or pin
    # its own distinct coordinate along a walking route.
    stop_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    stop_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["journey", "sequence_order"], name="unique_journey_sequence_order"
            )
        ]
        ordering = ["sequence_order"]
