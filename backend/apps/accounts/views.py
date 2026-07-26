from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer
from .services import GoogleOAuthService


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"user": UserSerializer(user).data, "tokens": _tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response({"user": UserSerializer(user).data, "tokens": _tokens_for(user)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Blacklist the refresh token so it can't be reused (needs
        # rest_framework_simplejwt.token_blacklist in INSTALLED_APPS + migrate).
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class GoogleRedirectView(APIView):
    """Returns the Google consent-screen URL for the frontend to redirect to."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"url": GoogleOAuthService().authorization_url()})


class GoogleCallbackView(APIView):
    """Exchanges the ?code=... from Google for a user, then issues our own JWTs."""

    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get("code")
        if not code:
            return Response({"detail": "Missing code"}, status=status.HTTP_400_BAD_REQUEST)
        user = GoogleOAuthService().authenticate_with_code(code)
        return Response({"user": UserSerializer(user).data, "tokens": _tokens_for(user)})
