from django.contrib import admin

from .models import PartnerOrganization


@admin.register(PartnerOrganization)
class PartnerOrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_user", "verified", "created_at"]
    list_filter = ["verified"]
