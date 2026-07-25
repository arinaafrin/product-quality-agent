from rest_framework.routers import DefaultRouter

from .views import PartnerOrganizationViewSet

router = DefaultRouter(trailing_slash=False)
router.register(
    "partner-organizations", PartnerOrganizationViewSet, basename="partner-organization"
)

urlpatterns = router.urls
