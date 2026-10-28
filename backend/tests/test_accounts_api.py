"""Accounts API (P6) against PostgreSQL. Skipped when the database isn't available."""

from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from app.accounts import service
from app.accounts.models import (
    ClubRole,
    ClubRoleKind,
    LoginSession,
    PasswordResetToken,
    Student,
    StudentStatus,
)
from app.core.auth import create_session
from app.core.security import hash_token
from app.core.settings import get_settings
from tests.factories import PASSWORD, add_coordinator, login, make_club, make_student

API = "/api/v1"
COOKIE = get_settings().session_cookie_name
NEW_PASSWORD = "a brand new password"

PROFILE = dict(name="Asha K", roll_no="21CS001", department="CSE", year=3, section="B")


@pytest.fixture
def outbox(monkeypatch) -> list:
    """Records every account email instead of writing `.eml` files."""
    sent: list = []

    class FakeSender:
        def send(self, message):
            sent.append(message)
            return "fake-id"

    monkeypatch.setattr(service, "get_email_sender", lambda: FakeSender())
    return sent


def _token_from(message) -> str:
    link = next(word for word in message.text.split() if "reset-password?token=" in word)
    return parse_qs(urlparse(link).query)["token"][0]


def _keep_cookie(client, response) -> None:
    """Carry the session cookie over by hand: outside local development it is `Secure`,
    and the test client talks plain HTTP, so it wouldn't send it back on its own."""
    client.cookies.set(COOKIE, response.cookies[COOKIE])


def _signup(client, email="Asha@Example.com", password=PASSWORD):
    return client.post(f"{API}/auth/signup", json={**PROFILE, "email": email, "password": password})


# --- Signup, login, logout ------------------------------------------------------------


def test_signup_login_me(client, db):
    response = _signup(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "asha@example.com"
    assert body["status"] == "active"
    assert body["is_platform_admin"] is False
    assert COOKIE in response.cookies
    _keep_cookie(client, response)

    assert client.get(f"{API}/me").json()["id"] == body["id"]

    client.cookies.clear()
    assert client.get(f"{API}/me").status_code == 401
    response = client.post(
        f"{API}/auth/login", json={"email": "ASHA@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["id"] == body["id"]
    _keep_cookie(client, response)
    assert client.get(f"{API}/me").status_code == 200


def test_signup_duplicate_email_is_409(client, db):
    assert _signup(client).status_code == 201
    response = _signup(client, email="asha@EXAMPLE.com")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_wrong_password_and_unknown_email_are_the_same_401(client, db):
    student = make_student(db)
    wrong = client.post(f"{API}/auth/login", json={"email": student.email, "password": "nope-nope"})
    unknown = client.post(
        f"{API}/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"


def test_removed_and_passwordless_accounts_cannot_log_in(client, db):
    removed = make_student(db, status=StudentStatus.REMOVED, removed_at=datetime.now(UTC))
    no_password = make_student(db, password_hash=None)
    for student in (removed, no_password):
        response = client.post(
            f"{API}/auth/login", json={"email": student.email, "password": PASSWORD}
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_credentials"


def test_logout_kills_the_session(client, db):
    student = make_student(db)
    login(client, db, student)
    token = client.cookies.get(COOKIE)
    assert client.get(f"{API}/me").status_code == 200

    assert client.post(f"{API}/auth/logout").status_code == 204
    db.expire_all()
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == hash_token(token)))
    assert session.revoked_at is not None

    client.cookies.set(COOKIE, token)  # replaying the old cookie doesn't work
    assert client.get(f"{API}/me").status_code == 401


def test_logout_without_session_is_204(client, db):
    assert client.post(f"{API}/auth/logout").status_code == 204


# --- Password reset -------------------------------------------------------------------


def test_full_reset_flow(client, db, outbox):
    student = make_student(db)
    login(client, db, student)
    old_token = client.cookies.get(COOKIE)

    response = client.post(f"{API}/auth/password-reset", json={"email": student.email.upper()})
    assert response.status_code == 202
    assert len(outbox) == 1
    assert outbox[0].to == student.email
    assert outbox[0].text.count(f"{get_settings().frontend_base_url}/reset-password?token=") == 1
    raw = _token_from(outbox[0])

    stored = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.student_id == student.id)
    )
    assert stored.token_hash == hash_token(raw)  # only the hash is stored
    expected = datetime.now(UTC) + timedelta(minutes=get_settings().password_reset_ttl_minutes)
    assert abs(stored.expires_at - expected) < timedelta(minutes=1)

    response = client.post(
        f"{API}/auth/password-reset/confirm", json={"token": raw, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 204

    client.cookies.set(COOKIE, old_token)  # every session was revoked
    assert client.get(f"{API}/me").status_code == 401
    client.cookies.clear()

    bad = client.post(f"{API}/auth/login", json={"email": student.email, "password": PASSWORD})
    assert bad.status_code == 401
    good = client.post(f"{API}/auth/login", json={"email": student.email, "password": NEW_PASSWORD})
    assert good.status_code == 200


def test_reset_token_is_single_use(client, db, outbox):
    student = make_student(db)
    client.post(f"{API}/auth/password-reset", json={"email": student.email})
    raw = _token_from(outbox[0])
    body = {"token": raw, "new_password": NEW_PASSWORD}
    assert client.post(f"{API}/auth/password-reset/confirm", json=body).status_code == 204
    again = client.post(f"{API}/auth/password-reset/confirm", json=body)
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "invalid_token"


def test_expired_reset_token_is_rejected(client, db, outbox):
    student = make_student(db)
    client.post(f"{API}/auth/password-reset", json={"email": student.email})
    raw = _token_from(outbox[0])
    stored = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.student_id == student.id)
    )
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.flush()

    response = client.post(
        f"{API}/auth/password-reset/confirm", json={"token": raw, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_token"


def test_unknown_token_is_rejected(client, db):
    response = client.post(
        f"{API}/auth/password-reset/confirm",
        json={"token": "made-up", "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_token"


def test_password_reset_unknown_email_is_202_and_sends_nothing(client, db, outbox):
    response = client.post(f"{API}/auth/password-reset", json={"email": "ghost@example.com"})
    assert response.status_code == 202
    assert outbox == []


def test_change_password_keeps_this_session_and_revokes_others(client, db):
    student = make_student(db)
    other_token = create_session(db, student)
    login(client, db, student)

    wrong = client.post(
        f"{API}/me/password",
        json={"current_password": "not-it-at-all", "new_password": NEW_PASSWORD},
    )
    assert wrong.status_code == 400

    response = client.post(
        f"{API}/me/password", json={"current_password": PASSWORD, "new_password": NEW_PASSWORD}
    )
    assert response.status_code == 204
    assert client.get(f"{API}/me").status_code == 200

    client.cookies.set(COOKIE, other_token)
    assert client.get(f"{API}/me").status_code == 401


def test_patch_me_updates_profile_but_not_email(client, db):
    student = make_student(db)
    login(client, db, student)
    response = client.patch(
        f"{API}/me", json={"name": "New Name", "year": 4, "email": "x@example.com"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New Name"
    assert body["year"] == 4
    assert body["email"] == student.email


# --- Platform Admin -------------------------------------------------------------------


def test_admin_routes_are_403_for_non_admins(client, db):
    student = make_student(db)
    club = make_club(db)
    login(client, db, student)
    calls = [
        ("get", f"{API}/admin/students", None),
        ("post", f"{API}/admin/students", {**PROFILE, "email": "n@example.com"}),
        ("delete", f"{API}/admin/students/{student.id}", None),
        ("post", f"{API}/admin/clubs", {"name": "X", "slug": "x-club"}),
        ("put", f"{API}/admin/clubs/{club.id}/president", {"student_id": str(student.id)}),
    ]
    for method, url, body in calls:
        kwargs = {"json": body} if body is not None else {}
        response = client.request(method.upper(), url, **kwargs)
        assert response.status_code == 403, url
        assert response.json()["error"]["code"] == "forbidden"


def test_admin_search_by_roll_no(client, db):
    admin = make_student(db, is_platform_admin=True)
    a = make_student(db, roll_no="21CS042")
    b = make_student(db, roll_no="21cs042")  # roll numbers aren't unique (R2)
    make_student(db, roll_no="21CS0420")
    login(client, db, admin)

    response = client.get(f"{API}/admin/students", params={"roll_no": "21Cs042"})
    assert response.status_code == 200
    assert {s["id"] for s in response.json()} == {str(a.id), str(b.id)}

    page = client.get(f"{API}/admin/students", params={"limit": 2})
    assert page.status_code == 200
    assert len(page.json()) == 2
    assert client.get(f"{API}/admin/students", params={"limit": 201}).status_code == 422


def test_admin_adds_student_who_sets_password(client, db, outbox):
    admin = make_student(db, is_platform_admin=True)
    login(client, db, admin)
    response = client.post(f"{API}/admin/students", json={**PROFILE, "email": "New@Example.com"})
    assert response.status_code == 201
    created = db.get(Student, response.json()["id"])
    assert created.email == "new@example.com"
    assert created.password_hash is None

    stored = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.student_id == created.id)
    )
    assert abs(stored.expires_at - (datetime.now(UTC) + timedelta(days=7))) < timedelta(minutes=1)

    raw = _token_from(outbox[0])
    client.cookies.clear()
    assert (
        client.post(
            f"{API}/auth/password-reset/confirm",
            json={"token": raw, "new_password": NEW_PASSWORD},
        ).status_code
        == 204
    )
    login_response = client.post(
        f"{API}/auth/login", json={"email": "new@example.com", "password": NEW_PASSWORD}
    )
    assert login_response.status_code == 200


def test_removing_a_student_keeps_the_row_and_drops_roles_and_sessions(client, db):
    admin = make_student(db, is_platform_admin=True)
    target = make_student(db)
    club = make_club(db, president=target)
    other_club = make_club(db)
    add_coordinator(db, other_club, target)
    target_token = create_session(db, target)
    login(client, db, admin)

    assert client.delete(f"{API}/admin/students/{target.id}").status_code == 204

    db.expire_all()
    assert target.status == StudentStatus.REMOVED
    assert target.removed_at is not None
    assert db.scalars(select(ClubRole).where(ClubRole.student_id == target.id)).all() == []
    sessions = db.scalars(select(LoginSession).where(LoginSession.student_id == target.id)).all()
    assert sessions and all(s.revoked_at is not None for s in sessions)

    # Removed students can't be given roles.
    response = client.put(
        f"{API}/admin/clubs/{club.id}/president", json={"student_id": str(target.id)}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "student_removed"

    client.cookies.set(COOKIE, target_token)
    assert client.get(f"{API}/me").status_code == 401


def test_admin_cannot_remove_self(client, db):
    admin = make_student(db, is_platform_admin=True)
    login(client, db, admin)
    response = client.delete(f"{API}/admin/students/{admin.id}")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "cannot_remove_self"


def test_create_club_and_duplicate_slug(client, db):
    admin = make_student(db, is_platform_admin=True)
    login(client, db, admin)
    response = client.post(f"{API}/admin/clubs", json={"name": "Robotics", "slug": "robotics-x1"})
    assert response.status_code == 201
    assert response.json()["slug"] == "robotics-x1"
    assert response.json()["university_id"]

    again = client.post(f"{API}/admin/clubs", json={"name": "Other", "slug": "robotics-x1"})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "slug_taken"


def test_president_assignment_replaces_the_old_one(client, db):
    admin = make_student(db, is_platform_admin=True)
    old = make_student(db)
    new = make_student(db)
    club = make_club(db, president=old)
    add_coordinator(db, club, new)
    login(client, db, admin)

    response = client.put(
        f"{API}/admin/clubs/{club.id}/president", json={"student_id": str(new.id)}
    )
    assert response.status_code == 200
    assert response.json() == {"student_id": str(new.id), "name": new.name, "role": "president"}

    db.expire_all()
    roles = db.scalars(select(ClubRole).where(ClubRole.club_id == club.id)).all()
    assert [(r.student_id, r.role) for r in roles] == [(new.id, ClubRoleKind.PRESIDENT)]

    listed = client.get(f"{API}/clubs/{club.id}/roles")
    assert listed.status_code == 200
    assert listed.json() == [{"student_id": str(new.id), "name": new.name, "role": "president"}]


# --- Club Roles -----------------------------------------------------------------------


def test_coordinators_are_managed_by_the_president_only(client, db):
    president = make_student(db)
    coordinator = make_student(db)
    newcomer = make_student(db)
    club = make_club(db, president=president)
    add_coordinator(db, club, coordinator)

    # A Coordinator can see the roles but not change them.
    login(client, db, coordinator)
    assert client.get(f"{API}/clubs/{club.id}/roles").status_code == 200
    response = client.post(
        f"{API}/clubs/{club.id}/coordinators", json={"student_id": str(newcomer.id)}
    )
    assert response.status_code == 403
    assert client.delete(f"{API}/clubs/{club.id}/coordinators/{coordinator.id}").status_code == 403

    login(client, db, president)
    response = client.post(
        f"{API}/clubs/{club.id}/coordinators", json={"student_id": str(newcomer.id)}
    )
    assert response.status_code == 201
    assert response.json()["role"] == "coordinator"

    dup = client.post(f"{API}/clubs/{club.id}/coordinators", json={"student_id": str(newcomer.id)})
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "already_has_role"

    no_president = client.delete(f"{API}/clubs/{club.id}/coordinators/{president.id}")
    assert no_president.status_code == 400
    assert no_president.json()["error"]["code"] == "cannot_remove_president"

    assert client.delete(f"{API}/clubs/{club.id}/coordinators/{newcomer.id}").status_code == 204
    roles = {r["student_id"] for r in client.get(f"{API}/clubs/{club.id}/roles").json()}
    assert roles == {str(president.id), str(coordinator.id)}


def test_roles_only_count_in_their_own_club(client, db):
    """R6: a Coordinator of Club A has no rights in Club B."""
    coordinator = make_student(db)
    outsider = make_student(db)
    club_a = make_club(db)
    club_b = make_club(db, president=make_student(db))
    add_coordinator(db, club_a, coordinator)
    login(client, db, coordinator)

    assert client.get(f"{API}/clubs/{club_b.id}/roles").status_code == 403
    response = client.post(
        f"{API}/clubs/{club_b.id}/coordinators", json={"student_id": str(outsider.id)}
    )
    assert response.status_code == 403


def test_removed_student_cannot_be_appointed_coordinator(client, db):
    president = make_student(db)
    removed = make_student(db, status=StudentStatus.REMOVED, removed_at=datetime.now(UTC))
    club = make_club(db, president=president)
    login(client, db, president)
    response = client.post(
        f"{API}/clubs/{club.id}/coordinators", json={"student_id": str(removed.id)}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "student_removed"
