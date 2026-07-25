from django.contrib import admin

from .models import ModerationLog


@admin.register(ModerationLog)
class ModerationLogAdmin(admin.ModelAdmin):
    list_display = ["experience", "reviewer", "action", "created_at"]
    list_filter = ["action"]
