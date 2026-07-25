from rest_framework.routers import DefaultRouter

from .views import JourneyViewSet

router = DefaultRouter(trailing_slash=False)
router.register("journeys", JourneyViewSet, basename="journey")

urlpatterns = router.urls
