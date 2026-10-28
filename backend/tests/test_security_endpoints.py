"""Access control on every endpoint, built from the live route table (R6; RULES.md
engineering rule 7, domain rule 8).

The route list comes from the app itself, so a route added later is checked automatically:
it must either need a login (401 without one) or be added to PUBLIC on purpose. Every
club-scoped route must be listed in CLUB_SCOPED (or PERSONAL / ADMIN), so a new one can't
skip the cross-Club check either.
"""

import re
import uuid

import pytest
from fastapi.routing import iter_route_contexts
from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.certificates.models import (
    Certificate,
    CertificateBatch,
    CertificateBatchStatus,
    CertificateStatus,
    CertificateTemplate,
)
from app.main import API_PREFIX, create_app
from app.posters.models import Poster, PosterRenderStatus
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import add_coordinator, login, make_club, make_event, make_student

# --- the route table ---------------------------------------------------------------------

# Routes anyone may call without logging in. Changing this set is a security decision.
PUBLIC = {
    ("GET", "/health"),
    ("GET", "/openapi.json"),
    ("GET", "/docs"),
    ("GET", "/docs/oauth2-redirect"),
    ("POST", "/auth/signup"),
    ("POST", "/auth/login"),
    ("POST", "/auth/logout"),
    ("POST", "/auth/password-reset"),
    ("POST", "/auth/password-reset/confirm"),
    ("GET", "/events/{event_id}/public"),
    ("GET", "/verify/{public_id}"),
    ("POST", "/webhooks/email"),
}
EXPECTED_PUBLIC_COUNT = 12

# Platform Admin only.
ADMIN = {
    ("GET", "/admin/students"),
    ("POST", "/admin/students"),
    ("DELETE", "/admin/students/{student_id}"),
    ("POST", "/admin/clubs"),
    ("PUT", "/admin/clubs/{club_id}/president"),
}

# The logged-in Student's own data; scoped by the session, not by a Club.
PERSONAL = {
    ("POST", "/me/password"),
    ("GET", "/me"),
    ("PATCH", "/me"),
    ("GET", "/me/certificates"),
    ("GET", "/me/certificates/{certificate_id}/download"),
    ("POST", "/events/{event_id}/registrations"),
    ("DELETE", "/events/{event_id}/registrations/me"),
}

# Club-scoped: every one must refuse a Club Role from another Club. Value = request body.
CLUB_SCOPED: dict[tuple[str, str], dict | None] = {
    ("GET", "/clubs/{club_id}/roles"): None,
    ("POST", "/clubs/{club_id}/coordinators"): {"student_id": "{other_student}"},
    ("DELETE", "/clubs/{club_id}/coordinators/{student_id}"): None,
    ("POST", "/clubs/{club_id}/events"): {
        "name": "X",
        "starts_at": "2030-01-01T10:00:00Z",
        "ends_at": "2030-01-01T12:00:00Z",
    },
    ("GET", "/events/{event_id}"): None,
    ("PATCH", "/events/{event_id}"): {"name": "Renamed"},
    ("GET", "/events/{event_id}/form"): None,
    ("PUT", "/events/{event_id}/form"): {"fields": []},
    ("PUT", "/events/{event_id}/eligibility"): {"rules": []},
    ("POST", "/events/{event_id}/close"): None,
    ("POST", "/events/{event_id}/reopen"): None,
    ("GET", "/events/{event_id}/registrations"): None,
    ("POST", "/registrations/{registration_id}/approve"): None,
    ("POST", "/registrations/{registration_id}/reject"): None,
    ("GET", "/events/{event_id}/qr"): None,
    ("POST", "/events/{event_id}/posters"): "FILE",
    ("PUT", "/posters/{poster_id}/qr-area"): {"x": 0, "y": 0, "w": 300, "h": 300},
    ("POST", "/posters/{poster_id}/render"): None,
    ("GET", "/posters/{poster_id}/preview"): None,
    ("GET", "/posters/{poster_id}/final"): None,
    ("GET", "/events/{event_id}/export"): None,
    ("GET", "/events/{event_id}/attendance"): None,
    ("PUT", "/events/{event_id}/attendance"): {"absent_registration_ids": []},
    ("POST", "/events/{event_id}/certificate-templates"): "FILE",
    ("PUT", "/certificate-templates/{template_id}/placeholders"): {"placeholders": []},
    ("GET", "/certificate-templates/{template_id}/preview"): None,
    ("POST", "/events/{event_id}/certificate-batches"): {
        "template_id": "{template_id}",
        "message_subject": "s",
        "message_body": "b",
    },
    ("GET", "/certificate-batches/{batch_id}"): None,
    ("POST", "/certificate-batches/{batch_id}/retry"): None,
    ("POST", "/certificate-batches/{batch_id}/attendees"): {
        "registration_ids": ["{registration_id}"]
    },
    ("POST", "/certificates/{certificate_id}/reissue"): {"reason": "typo"},
    ("POST", "/certificates/{certificate_id}/revoke"): {"reason": "fraud"},
}

# Club routes only the President (not a Coordinator) may use.
PRESIDENT_ONLY = {
    ("POST", "/clubs/{club_id}/coordinators"),
    ("DELETE", "/clubs/{club_id}/coordinators/{student_id}"),
}

_PARAM = re.compile(r"\{(\w+)\}")


def live_routes() -> set[tuple[str, str]]:
    """(method, path without the /api/v1 prefix) for every route the app serves."""
    out: set[tuple[str, str]] = set()
    for route in iter_route_contexts(create_app().routes):
        path = route.path
        if not path.startswith(API_PREFIX) and not path.startswith("/docs"):
            continue
        rel = path.removeprefix(API_PREFIX)
        for method in route.methods or ():
            if method == "HEAD":
                continue
            out.add((method, rel))
    return out


ROUTES = sorted(live_routes())


def _url(path: str, ids: dict[str, str]) -> str:
    rel = _PARAM.sub(lambda m: ids[m.group(1)], path)
    return rel if rel.startswith("/docs") else f"{API_PREFIX}{rel}"


def _call(client, method: str, path: str, ids: dict[str, str], body=None):
    url = _url(path, ids)
    if body == "FILE":
        return client.request(
            method, url, files={"file": ("f.pdf", b"%PDF-1.4", "application/pdf")}
        )
    if isinstance(body, dict):
        body = _fill(body, ids)
        return client.request(method, url, json=body)
    return client.request(method, url)


def _fill(value, ids):
    if isinstance(value, str):
        m = re.fullmatch(r"\{(\w+)\}", value)
        return ids[m.group(1)] if m else value
    if isinstance(value, list):
        return [_fill(v, ids) for v in value]
    if isinstance(value, dict):
        return {k: _fill(v, ids) for k, v in value.items()}
    return value


def _random_ids() -> dict[str, str]:
    ids = {name: str(uuid.uuid4()) for name in _all_param_names()}
    ids["public_id"] = "ORG-0000-0000"
    ids["other_student"] = str(uuid.uuid4())
    return ids


def _all_param_names() -> set[str]:
    names = {"template_id", "registration_id", "other_student"}
    for _, path in ROUTES:
        names.update(_PARAM.findall(path))
    return names


# --- route table coverage ------------------------------------------------------------------


def test_public_allowlist_is_exactly_as_expected():
    # A new public route must fail here until someone adds it to PUBLIC on purpose.
    assert len(PUBLIC) == EXPECTED_PUBLIC_COUNT
    assert set(ROUTES) >= PUBLIC, PUBLIC - set(ROUTES)


def test_every_route_is_classified():
    classified = PUBLIC | ADMIN | PERSONAL | set(CLUB_SCOPED)
    unclassified = set(ROUTES) - classified
    assert not unclassified, f"Classify these routes in this file: {sorted(unclassified)}"
    stale = classified - set(ROUTES)
    assert not stale, f"These routes no longer exist: {sorted(stale)}"


@pytest.mark.parametrize(("method", "path"), [r for r in ROUTES if r not in PUBLIC])
def test_every_non_public_route_needs_login(db, client, method, path):
    response = _call(client, method, path, _random_ids(), CLUB_SCOPED.get((method, path)))
    assert response.status_code == 401, response.text
    assert response.json()["error"]["code"] == "not_authenticated"


# --- a fully seeded Club A, attacked from Club B ------------------------------------------


@pytest.fixture
def club_a(db: Session) -> dict[str, str]:
    """Club A with one of every club-scoped resource, so each id really exists."""
    president = make_student(db)
    club = make_club(db, president=president)
    coordinator = make_student(db)
    add_coordinator(db, club, coordinator)
    event = make_event(db, club, president, approval_required=True)
    attendee = make_student(db)
    registration = Registration(
        event_id=event.id,
        student_id=attendee.id,
        profile_snapshot={"name": attendee.name, "roll_no": attendee.roll_no},
        status=RegistrationStatus.PENDING,
    )
    db.add(registration)
    poster = Poster(
        event_id=event.id,
        original_file_key=f"posters/{event.id}/x/original.png",
        width_px=1000,
        height_px=1000,
        render_status=PosterRenderStatus.NONE,
        uploaded_by=president.id,
    )
    template = CertificateTemplate(
        event_id=event.id, file_key=f"certificate-templates/{event.id}/x.pdf"
    )
    db.add_all([poster, template])
    db.flush()
    batch = CertificateBatch(
        event_id=event.id,
        template_id=template.id,
        message_subject="s",
        message_body="b",
        created_by=president.id,
        status=CertificateBatchStatus.DONE,
    )
    db.add(batch)
    db.flush()
    certificate = Certificate(
        public_id="ORG-AAAA-AAAA",
        event_id=event.id,
        student_id=attendee.id,
        registration_id=registration.id,
        batch_id=batch.id,
        pdf_file_key=f"certificates/{event.id}/ORG-AAAA-AAAA.pdf",
        display={"name": attendee.name, "event": "E", "club": "C", "date": "2030-01-01"},
        status=CertificateStatus.VALID,
    )
    db.add(certificate)
    db.flush()
    return {
        "club_id": str(club.id),
        "event_id": str(event.id),
        "student_id": str(coordinator.id),
        "other_student": str(make_student(db).id),
        "registration_id": str(registration.id),
        "poster_id": str(poster.id),
        "template_id": str(template.id),
        "batch_id": str(batch.id),
        "certificate_id": str(certificate.id),
        "public_id": certificate.public_id,
    }


def _logged_in_as(client, db: Session, student: Student) -> None:
    client.cookies.clear()
    login(client, db, student)


@pytest.mark.parametrize(("method", "path"), sorted(CLUB_SCOPED))
def test_president_of_another_club_is_refused(db, client, club_a, method, path):
    outsider = make_student(db)
    make_club(db, president=outsider)  # Club B
    _logged_in_as(client, db, outsider)
    response = _call(client, method, path, club_a, CLUB_SCOPED[(method, path)])
    # Every id in `club_a` exists, so a 404 here would mean "not found" was hiding a
    # missing permission check. No club-scoped route hides existence today.
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize(("method", "path"), sorted(CLUB_SCOPED))
def test_student_without_a_club_role_is_refused(db, client, club_a, method, path):
    _logged_in_as(client, db, make_student(db))
    response = _call(client, method, path, club_a, CLUB_SCOPED[(method, path)])
    assert response.status_code == 403, response.text


@pytest.mark.parametrize(("method", "path"), sorted(CLUB_SCOPED))
def test_platform_admin_passes_the_club_check(db, client, club_a, method, path, enqueued):
    _logged_in_as(client, db, make_student(db, is_platform_admin=True))
    response = _call(client, method, path, club_a, CLUB_SCOPED[(method, path)])
    # Business rules may still say no (missing files, wrong state), but never "forbidden".
    assert response.status_code not in (401, 403), response.text
    assert response.status_code < 500, response.text


@pytest.mark.parametrize(("method", "path"), sorted(PRESIDENT_ONLY))
def test_coordinator_cannot_use_president_only_routes(db, client, club_a, method, path):
    coordinator = db.get(Student, uuid.UUID(club_a["student_id"]))
    _logged_in_as(client, db, coordinator)
    response = _call(client, method, path, club_a, CLUB_SCOPED[(method, path)])
    assert response.status_code == 403, response.text


ADMIN_BODIES: dict[tuple[str, str], dict] = {
    ("POST", "/admin/students"): {
        "email": "new-admin-test@example.com",
        "name": "N",
        "roll_no": "1",
        "department": "D",
        "year": 1,
        "section": "A",
    },
    ("POST", "/admin/clubs"): {"name": "N", "slug": "n-club-sec"},
    ("PUT", "/admin/clubs/{club_id}/president"): {"student_id": "{other_student}"},
}


@pytest.mark.parametrize(("method", "path"), sorted(ADMIN))
def test_ordinary_student_is_refused_admin_routes(db, client, club_a, method, path):
    _logged_in_as(client, db, make_student(db))
    response = _call(client, method, path, club_a, ADMIN_BODIES.get((method, path)))
    assert response.status_code == 403, response.text


@pytest.mark.parametrize(("method", "path"), sorted(ADMIN))
def test_club_president_is_refused_admin_routes(db, client, club_a, method, path):
    president = make_student(db)
    make_club(db, president=president)
    _logged_in_as(client, db, president)
    response = _call(client, method, path, club_a, ADMIN_BODIES.get((method, path)))
    assert response.status_code == 403, response.text


def test_another_students_certificate_download_is_404(db, client, club_a):
    _logged_in_as(client, db, make_student(db))
    response = client.get(f"{API_PREFIX}/me/certificates/{club_a['certificate_id']}/download")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "certificate_not_found"


def test_my_certificates_lists_only_my_own(db, client, club_a):
    _logged_in_as(client, db, make_student(db))
    assert client.get(f"{API_PREFIX}/me/certificates").json() == []


def test_my_registration_cancel_only_touches_my_own(db, client, club_a):
    _logged_in_as(client, db, make_student(db))
    response = client.delete(f"{API_PREFIX}/events/{club_a['event_id']}/registrations/me")
    assert response.status_code == 404
    db.expire_all()
    reg = db.get(Registration, uuid.UUID(club_a["registration_id"]))
    assert reg.status == RegistrationStatus.PENDING
