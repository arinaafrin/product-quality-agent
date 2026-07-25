from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class PartnerOrganization(BaseModel):
    name = models.CharField(max_length=255)
    contact_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="partner_organizations",
    )
    verified = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["verified"])]

    def __str__(self):
        return self.name
