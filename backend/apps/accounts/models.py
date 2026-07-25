import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    """
    Custom user model: UUID primary key, email as the login field, and a
    `role` used for coarse-grained authorization (visitor/partner/admin) —
    this mirrors app/Models/User.php in the Laravel backend exactly.
    """

    class Role(models.TextChoices):
        VISITOR = "visitor", "Visitor"
        PARTNER = "partner", "Partner"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None  # we log in with email, not a separate username
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VISITOR)
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    def __str__(self):
        return self.email

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_partner(self) -> bool:
        return self.role == self.Role.PARTNER
