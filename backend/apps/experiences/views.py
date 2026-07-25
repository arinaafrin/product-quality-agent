from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Experience, Favorite, MediaAsset
from .permissions import ExperiencePolicy
from .serializers import ExperienceSerializer, FavoriteSerializer, MediaAssetSerializer
from .services import GoogleMapsService


class ExperienceViewSet(viewsets.ModelViewSet):
    """
    Index/show are public (approved experiences only, unless you own them or
    are an admin — enforced by ExperiencePolicy). Create/update/delete
    require auth. Mirrors ExperienceController in the Laravel backend.
    """

    serializer_class = ExperienceSerializer
    permission_classes = [ExperiencePolicy]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        from django.db.models import Q

        qs = Experience.objects.select_related("city").all()
        user = self.request.user
        if user.is_authenticated and (user.is_admin or user.is_partner):
            pass  # admins/partners can see everything
        elif user.is_authenticated:
            qs = qs.filter(Q(status=Experience.Status.APPROVED) | Q(created_by=user))
        else:
            qs = qs.filter(status=Experience.Status.APPROVED)
        city_id = self.request.query_params.get("city")
        year = self.request.query_params.get("year")
        if city_id:
            qs = qs.filter(city_id=city_id)
        if year:
            qs = qs.filter(year=year)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        experience = serializer.save()
        # Resolve google_maps_link -> pin_latitude/longitude/place_name, best-effort.
        if experience.google_maps_link:
            GoogleMapsService().resolve_link(experience)


class ExperienceMediaView(generics.ListCreateAPIView):
    """
    GET /experiences/{id}/media — public listing (assets only exist on
    viewable experiences). POST /experiences/{id}/media — upload, requires
    auth + ownership. One route, two verbs — same as MediaController@index/store.
    """

    serializer_class = MediaAssetSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        return MediaAsset.objects.filter(experience_id=self.kwargs["experience_id"])

    def perform_create(self, serializer):
        experience = Experience.objects.get(pk=self.kwargs["experience_id"])
        self.check_object_permissions(self.request, experience)
        serializer.save(experience=experience)


class FavoriteListView(generics.ListAPIView):
    """GET /me/favorites"""

    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("experience")


class FavoriteToggleView(APIView):
    """POST /experiences/{id}/favorite and DELETE /experiences/{id}/favorite"""

    permission_classes = [IsAuthenticated]

    def post(self, request, experience_id):
        experience = Experience.objects.get(pk=experience_id)
        favorite, created = Favorite.objects.get_or_create(user=request.user, experience=experience)
        return Response(
            FavoriteSerializer(favorite).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, experience_id):
        Favorite.objects.filter(user=request.user, experience_id=experience_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
