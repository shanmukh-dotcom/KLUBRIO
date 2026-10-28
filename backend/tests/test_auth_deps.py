"""Auth dependencies. The first group uses a fake database session; the second needs
PostgreSQL (the `db` fixture) and is skipped without it."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI, Response
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounts.models import LoginSession, Student, StudentStatus
from app.core.auth import (
    CurrentStudent,
    OptionalStudent,
    PlatformAdmin,
    clear_session_cookie,
    create_session,
    revoke_all_sessions,
    revoke_session,
    set_session_cookie,
)
from app.core.db import get_session
from app.core.errors import register_error_handlers
from app.core.security import hash_token, new_token
from app.core.settings import get_settings

COOKIE = get_settings().session_cookie_name


class FakeSession:
    """Stands in for a SQLAlchemy Session: every lookup finds nothing."""

    def scalar(self, *_args, **_kwargs):
        return None


def _app(session_factory) -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/me")
    def me(student: CurrentStudent) -> dict[str, str]:
        return {"email": student.email}

    @app.get("/maybe")
    def maybe(student: OptionalStudent) -> dict[str, str | None]:
        return {"email": student.email if student else None}

    @app.get("/admin")
    def admin(student: PlatformAdmin) -> dict[str, str]:
        return {"email": student.email}

    @app.post("/login")
    def login(response: Response) -> dict[str, bool]:
        set_session_cookie(response, "the-token")
        return {"ok": True}

    @app.post("/logout")
    def logout(response: Response) -> dict[str, bool]:
        clear_session_cookie(response)
        return {"ok": True}

    app.dependency_overrides[get_session] = session_factory
    return app


def _fake_client() -> TestClient:
    def fake_session() -> Iterator[FakeSession]:
        yield FakeSession()

    return TestClient(_app(fake_session))


# --- No database needed ---------------------------------------------------------------


def test_no_cookie_is_401():
    response = _fake_client().get("/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_no_cookie_optional_is_none():
    response = _fake_client().get("/maybe")
    assert response.status_code == 200
    assert response.json() == {"email": None}


def test_unknown_token_is_401():
    response = _fake_client().get("/me", headers={"Cookie": f"{COOKIE}=not-a-real-token"})
    assert response.status_code == 401


def test_session_cookie_flags():
    response = _fake_client().post("/login")
    header = response.headers["set-cookie"]
    parts = [p.strip().lower() for p in header.split(";")]
    assert parts[0] == f"{COOKIE}=the-token".lower()
    assert "httponly" in parts
    assert "samesite=lax" in parts
    assert "path=/" in parts
    assert f"max-age={get_settings().session_ttl_days * 86400}" in parts
    assert ("secure" in parts) == get_settings().cookie_secure


def test_clear_session_cookie_expires_it():
    header = _fake_client().post("/logout").headers["set-cookie"].lower()
    assert header.startswith(f"{COOKIE}=".lower())
    assert "max-age=0" in header
    assert "httponly" in header


# --- Needs PostgreSQL -----------------------------------------------------------------


def _student(db: Session, email: str, *, admin: bool = False) -> Student:
    student = Student(
        email=email,
        name="Test",
        roll_no="21CS001",
        department="CSE",
        year=3,
        section="A",
        is_platform_admin=admin,
    )
    db.add(student)
    db.flush()
    return student


def _db_client(db: Session) -> TestClient:
    def session_override() -> Iterator[Session]:
        yield db

    return TestClient(_app(session_override))


def _me(db: Session, token: str):
    return _db_client(db).get("/maybe", headers={"Cookie": f"{COOKIE}={token}"}).json()["email"]


def test_create_session_then_lookup_returns_student(db):
    student = _student(db, "auth1@example.com")
    token = create_session(db, student)
    stored = db.query(LoginSession).filter_by(student_id=student.id).one()
    assert stored.token_hash == hash_token(token)
    assert stored.token_hash != token
    assert _me(db, token) == "auth1@example.com"
    response = _db_client(db).get("/me", headers={"Cookie": f"{COOKIE}={token}"})
    assert response.status_code == 200


def test_revoked_session_returns_none(db):
    student = _student(db, "auth2@example.com")
    token = create_session(db, student)
    revoke_session(db, token)
    assert _me(db, token) is None


def test_revoke_all_sessions(db):
    student = _student(db, "auth3@example.com")
    first, second = create_session(db, student), create_session(db, student)
    revoke_all_sessions(db, student.id)
    assert _me(db, first) is None
    assert _me(db, second) is None


def test_expired_session_returns_none(db):
    student = _student(db, "auth4@example.com")
    token = new_token()
    db.add(
        LoginSession(
            student_id=student.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
    )
    db.flush()
    assert _me(db, token) is None


def test_removed_student_returns_none(db):
    student = _student(db, "auth5@example.com")
    token = create_session(db, student)
    student.status = StudentStatus.REMOVED
    db.flush()
    assert _me(db, token) is None


def test_platform_admin_dependency(db):
    plain = _student(db, "auth6@example.com")
    admin = _student(db, "auth7@example.com", admin=True)
    client = _db_client(db)
    plain_token, admin_token = create_session(db, plain), create_session(db, admin)
    response = client.get("/admin", headers={"Cookie": f"{COOKIE}={plain_token}"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
    response = client.get("/admin", headers={"Cookie": f"{COOKIE}={admin_token}"})
    assert response.status_code == 200
