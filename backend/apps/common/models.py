import uuid

from django.db import models


class UUIDModel(models.Model):
    """
    Abstract base giving every table a UUID primary key, matching the
    Laravel migrations (`$table->uuid('id')->primary()` + HasUuids trait).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Adds created_at / updated_at, the equivalent of Eloquent's $timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """Most domain models inherit from this: UUID pk + created/updated timestamps."""

    class Meta:
        abstract = True
