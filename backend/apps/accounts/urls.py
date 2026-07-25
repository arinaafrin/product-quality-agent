from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="auth-register"),
    path("login", views.LoginView.as_view(), name="auth-login"),
    path("logout", views.LogoutView.as_view(), name="auth-logout"),
    path("refresh", TokenRefreshView.as_view(), name="auth-refresh"),
    path("google/redirect", views.GoogleRedirectView.as_view(), name="google-redirect"),
    path("google/callback", views.GoogleCallbackView.as_view(), name="google-callback"),
]

# /me is not under /auth/ in the API (matches Laravel's routes/api.php layout).
me_urlpatterns = [
    path("me", views.MeView.as_view(), name="me"),
]
