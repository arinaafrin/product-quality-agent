import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.cities.models import City


@pytest.mark.django_db
def test_ping():
    client = APIClient()
    response = client.get("/api/v1/ping")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.django_db
def test_register_and_login():
    client = APIClient()
    response = client.post(
        "/api/v1/auth/register",
        {"name": "Ada Lovelace", "email": "ada@example.com", "password": "S3curePass!23"},
        format="json",
    )
    assert response.status_code == 201
    assert "tokens" in response.json()

    response = client.post(
        "/api/v1/auth/login",
        {"email": "ada@example.com", "password": "S3curePass!23"},
        format="json",
    )
    assert response.status_code == 200
    access_token = response.json()["tokens"]["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    me_response = client.get("/api/v1/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "ada@example.com"


@pytest.mark.django_db
def test_cities_are_publicly_listable():
    City.objects.create(name="Rome", country="Italy", latitude=41.9028, longitude=12.4964)
    client = APIClient()
    response = client.get("/api/v1/cities")
    assert response.status_code == 200
    assert response.json()["count"] == 1


@pytest.mark.django_db
def test_experience_create_requires_auth():
    city = City.objects.create(name="Kyoto", country="Japan", latitude=35.0116, longitude=135.7681)
    client = APIClient()
    response = client.post(
        "/api/v1/experiences", {"city": str(city.id), "year": 1890}, format="json"
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_experience_create_and_list_flow():
    user = User.objects.create_user(
        email="curator@example.com", password="pw12345!ABC", name="Curator"
    )
    city = City.objects.create(name="Kyoto", country="Japan", latitude=35.0116, longitude=135.7681)

    client = APIClient()
    client.force_authenticate(user=user)
    create_response = client.post(
        "/api/v1/experiences", {"city": str(city.id), "year": 1890}, format="json"
    )
    assert create_response.status_code == 201
    assert create_response.json()["status"] == "draft"

    # Draft experiences are only visible to their owner/admin, not the public.
    anon_response = APIClient().get("/api/v1/experiences")
    assert anon_response.json()["count"] == 0

    owner_response = client.get("/api/v1/experiences")
    assert owner_response.json()["count"] == 1
