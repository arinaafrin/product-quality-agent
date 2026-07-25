from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from .models import City
from .serializers import CitySerializer


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public, read-only. Feeds the Explorer map/search UI, same role as
    CityController::index/show in the Laravel backend.
    """

    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "country"]
