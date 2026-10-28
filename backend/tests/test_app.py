from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def test_health_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unknown_route_uses_error_shape():
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_openapi_is_published():
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"] == "ORGniser API"
    for path in ("/api/v1/events/{event_id}/registrations", "/api/v1/verify/{public_id}"):
        assert path in spec["paths"]


def test_protected_endpoint_without_login_uses_error_shape():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_verification_response_has_no_private_fields():
    spec = client.get("/api/v1/openapi.json").json()
    fields = set(spec["components"]["schemas"]["VerificationOut"]["properties"])
    assert not fields & {"roll_no", "email", "answers"}


def test_validation_error_uses_error_shape():
    response = client.post("/api/v1/auth/login", json={"email": "not-an-email"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
