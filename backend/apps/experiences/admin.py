from django.contrib import admin

from .models import Experience, Favorite, MediaAsset


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ["city", "year", "status", "created_by", "created_at"]
    list_filter = ["status", "city"]
    search_fields = ["era_label"]


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ["experience", "type", "source_type", "created_at"]
    list_filter = ["type", "source_type"]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ["user", "experience", "created_at"]
