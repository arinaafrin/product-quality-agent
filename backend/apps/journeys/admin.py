from django.contrib import admin

from .models import Journey, JourneyStop


class JourneyStopInline(admin.TabularInline):
    model = JourneyStop
    extra = 0


@admin.register(Journey)
class JourneyAdmin(admin.ModelAdmin):
    list_display = ["title", "city", "status", "created_by", "created_at"]
    list_filter = ["status", "city"]
    inlines = [JourneyStopInline]
