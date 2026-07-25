import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class GoogleMapsService:
    """Python port of app/Services/Maps/GoogleMapsService.php."""

    PLACES_API_URL = "https://maps.googleapis.com/maps/api/place/details/json"

    def resolve_link(self, experience) -> bool:
        """
        Attempts to resolve `experience.google_maps_link` into
        pin_latitude/pin_longitude/pin_place_name. Best-effort: a dead link,
        unsupported URL format, or API quota failure should never block
        experience creation, so this always fails silently (logs + returns
        False) rather than raising.
        """
        if not settings.GOOGLE_MAPS_API_KEY or not experience.google_maps_link:
            return False
        try:
            response = requests.get(
                self.PLACES_API_URL,
                params={
                    "place_id": experience.google_maps_link,
                    "key": settings.GOOGLE_MAPS_API_KEY,
                    "fields": "name,geometry",
                },
                timeout=5,
            )
            response.raise_for_status()
            result = response.json().get("result", {})
            location = result.get("geometry", {}).get("location", {})
            if not location:
                return False
            experience.pin_latitude = location.get("lat")
            experience.pin_longitude = location.get("lng")
            experience.pin_place_name = result.get("name")
            experience.save(update_fields=["pin_latitude", "pin_longitude", "pin_place_name"])
            return True
        except requests.RequestException:
            logger.warning("Failed to resolve Google Maps link for experience %s", experience.id)
            return False
