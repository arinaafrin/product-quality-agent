from django.db import models

from apps.common.models import BaseModel


class City(BaseModel):
    name = models.CharField(max_length=255, db_index=True)
    country = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    google_place_id = models.CharField(max_length=255, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}, {self.country}"
