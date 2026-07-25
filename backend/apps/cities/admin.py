from django.contrib import admin

from .models import City


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "country", "latitude", "longitude"]
    search_fields = ["name", "country"]
