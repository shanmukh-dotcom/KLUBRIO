"""My Certificates and the public Verification Page (P5; R36, R38, R39, R42, rule 8)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.certificates.ids import new_certificate_id, normalise_certificate_id
from app.certificates.models import Certificate, CertificateStatus
from app.core.storage import LocalStorage
from app.registrations.models import Registration, RegistrationStatus
from app.verification import service as verification_service
from app.verification.schemas import VerificationOut
from app.verification.service import parse_display_date
from tests.factories import login, make_club, make_event, make_student

# --------------------------------------------------------------------------- pure


def test_normalise_accepts_lower_case_and_spaces():
    assert normalise_certificate_id(" org-7kq2-m9xd ") == "ORG-7KQ2-M9XD"
    assert normalise_certificate_id("org 7kq2 m9xd") == "ORG-7KQ2-M9XD"
    assert normalise_certificate_id("7KQ2M9XD") == "ORG-7KQ2-M9XD"


def test_normalise_fixes_o_0_and_i_1_mix_ups():
    assert normalise_certificate_id("ORG-O0I1-L1AB") == "ORG-0011-11AB"
    assert normalise_certificate_id("org-oioi-0000") == "ORG-0101-0000"


def test_normalise_rejects_garbage():
    assert normalise_certificate_id("") is None
    assert normalise_certificate_id("ORG-123") is None
    assert normalise_certificate_id("ORG-1234-5678-9") is None
    assert normalise_certificate_id("ORG-12#4-5678") is None


def test_parse_display_date():
    assert parse_display_date("2026-11-02").isoformat() == "2026-11-02"
    assert parse_display_date("2026-11-02T10:00:00+05:30").isoformat() == "2026-11-02"
    assert parse_display_date("not a date") is None
    assert parse_display_date(None) is None


def test_verification_schema_has_no_private_fields():
    assert not set(VerificationOut.model_fields) & {"roll_no", "email", "answers"}


# --------------------------------------------------------------------------- DB


def make_certificate(db, student, *, status=CertificateStatus.VALID, issued_at=None, **extra):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Hackfest")
    registration = Registration(
        event_id=event.id,
        student_id=student.id,
        profile_snapshot={"name": student.name, "roll_no": student.roll_no},
        answers={"team_name": "Rockets"},
        status=RegistrationStatus.CONFIRMED,
    )
    db.add(registration)
    db.flush()
    cert = Certificate(
        public_id=new_certificate_id(),
        event_id=event.id,
        student_id=student.id,
        registration_id=registration.id,
        pdf_file_key=f"certificates/{uuid.uuid4().hex}.pdf",
        display={
            "name": student.name,
            "event": "Hackfest",
            "club": "Test Club",
            "date": "2026-11-02",
        },
        status=status,
        issued_at=issued_at or datetime.now(UTC),
        **extra,
    )
    db.add(cert)
    db.flush()
    return cert


@pytest.fixture
def storage(tmp_path, monkeypatch):
    store = LocalStorage(tmp_path)
    monkeypatch.setattr(verification_service, "get_storage", lambda: store)
    return store


def test_my_certificates_lists_only_mine_newest_first(db, client):
    me, other = make_student(db), make_student(db)
    old = make_certificate(db, me, issued_at=datetime.now(UTC) - timedelta(days=3))
    new = make_certificate(db, me)
    make_certificate(db, other)
    login(client, db, me)

    response = client.get("/api/v1/me/certificates")
    assert response.status_code == 200
    body = response.json()
    assert [c["public_id"] for c in body] == [new.public_id, old.public_id]
    assert body[0]["event_name"] == "Hackfest"
    assert body[0]["club_name"] == "Test Club"
    assert body[0]["event_date"] == "2026-11-02"
    assert body[0]["superseded_by_public_id"] is None


def test_my_certificates_shows_replacement_of_superseded(db, client):
    me = make_student(db)
    replacement = make_certificate(db, me)
    old = make_certificate(
        db,
        me,
        status=CertificateStatus.SUPERSEDED,
        superseded_by=replacement.id,
        issued_at=datetime.now(UTC) - timedelta(days=1),
    )
    login(client, db, me)
    body = {c["public_id"]: c for c in client.get("/api/v1/me/certificates").json()}
    assert body[old.public_id]["status"] == "superseded"
    assert body[old.public_id]["superseded_by_public_id"] == replacement.public_id


def test_my_certificates_needs_login(db, client):
    assert client.get("/api/v1/me/certificates").status_code == 401


def test_download_someone_elses_certificate_is_404(db, client, storage):
    me, other = make_student(db), make_student(db)
    theirs = make_certificate(db, other)
    storage.put(theirs.pdf_file_key, b"%PDF-1.4 theirs", "application/pdf")
    login(client, db, me)

    response = client.get(f"/api/v1/me/certificates/{theirs.id}/download")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "certificate_not_found"
    unknown = client.get(f"/api/v1/me/certificates/{uuid.uuid4()}/download")
    assert unknown.json() == response.json()


def test_download_my_certificate_returns_pdf(db, client, storage):
    me = make_student(db)
    cert = make_certificate(db, me)
    storage.put(cert.pdf_file_key, b"%PDF-1.4 mine", "application/pdf")
    login(client, db, me)

    response = client.get(f"/api/v1/me/certificates/{cert.id}/download")
    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 mine"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("attachment")
    assert "x-certificate-status" not in response.headers


def test_download_revoked_certificate_is_flagged(db, client, storage):
    me = make_student(db)
    cert = make_certificate(db, me, status=CertificateStatus.REVOKED, revoked_reason="Typo")
    storage.put(cert.pdf_file_key, b"%PDF-1.4 revoked", "application/pdf")
    login(client, db, me)

    response = client.get(f"/api/v1/me/certificates/{cert.id}/download")
    assert response.status_code == 200
    assert response.headers["x-certificate-status"] == "revoked"


def test_verify_lowercase_input(db, client):
    holder = make_student(db)
    cert = make_certificate(db, holder)
    response = client.get(f"/api/v1/verify/{cert.public_id.lower()}")
    assert response.status_code == 200
    body = response.json()
    assert body["public_id"] == cert.public_id
    assert body["name"] == holder.name
    assert body["event_name"] == "Hackfest"
    assert body["club_name"] == "Test Club"
    assert body["event_date"] == "2026-11-02"
    assert body["status"] == "valid"
    assert body["superseded_by"] is None


def test_verify_superseded_shows_replacement(db, client):
    holder = make_student(db)
    replacement = make_certificate(db, holder)
    old = make_certificate(
        db, holder, status=CertificateStatus.SUPERSEDED, superseded_by=replacement.id
    )
    body = client.get(f"/api/v1/verify/{old.public_id}").json()
    assert body["status"] == "superseded"
    assert body["superseded_by"] == replacement.public_id


def test_verify_revoked_shows_reason(db, client):
    holder = make_student(db)
    when = datetime.now(UTC)
    cert = make_certificate(
        db,
        holder,
        status=CertificateStatus.REVOKED,
        revoked_reason="Issued in error",
        revoked_at=when,
    )
    body = client.get(f"/api/v1/verify/{cert.public_id}").json()
    assert body["status"] == "revoked"
    assert body["revoked_reason"] == "Issued in error"
    assert body["revoked_at"] is not None


def test_verify_unknown_and_unparseable_ids_are_404(db, client):
    unknown = client.get("/api/v1/verify/ORG-ZZZZ-ZZZZ")
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "certificate_not_found"
    garbage = client.get("/api/v1/verify/not-an-id")
    assert garbage.status_code == 404
    assert garbage.json() == unknown.json()


def test_verify_json_has_no_private_keys(db, client):
    holder = make_student(db)
    cert = make_certificate(db, holder)
    body = client.get(f"/api/v1/verify/{cert.public_id}").json()
    assert not set(body) & {"roll_no", "email", "answers"}
    assert holder.roll_no not in str(body)
    assert holder.email not in str(body)
