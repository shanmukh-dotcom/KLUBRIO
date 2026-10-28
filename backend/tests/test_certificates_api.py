"""Attendance and Certificate endpoints (P4: R27–R35, R40–R42). API tests use `client` + `db`
and skip when Postgres is not available. The PDF helpers here are reused by the batch and
load tests."""

import io
import uuid
from datetime import UTC, datetime

import pytest
from pypdf import PdfReader
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.certificates import jobs, service
from app.certificates.models import (
    Certificate,
    CertificateBatch,
    CertificateBatchItem,
    CertificateBatchItemStatus,
    CertificateBatchStatus,
    CertificateStatus,
)
from app.core.storage import LocalStorage
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import login, make_club, make_event, make_student

API = "/api/v1"
PAGE = landscape(A4)


# --- helpers ---------------------------------------------------------------------------------


def template_pdf(*lines: tuple[str, float], pages: int = 1) -> bytes:
    """A landscape A4 PDF with each `(text, font_size)` line centred down the page."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=PAGE)
    w, h = PAGE
    for _ in range(pages):
        y = h * 0.6
        for text, size in lines:
            c.setFont("Helvetica", size)
            c.drawCentredString(w / 2, y, text)
            y -= size * 2.5
        c.showPage()
    c.save()
    return buf.getvalue()


def default_template() -> bytes:
    return template_pdf(("{{name}}", 28), ("for attending {{event_name}}", 16))


def image_only_pdf() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=PAGE)
    c.setFillColorRGB(0.2, 0.3, 0.6)
    c.rect(40, 40, PAGE[0] - 80, PAGE[1] - 80, fill=1, stroke=0)
    c.showPage()
    c.save()
    return buf.getvalue()


def snapshot(student: Student) -> dict:
    return {
        "name": student.name,
        "roll_no": student.roll_no,
        "department": student.department,
        "year": student.year,
        "section": student.section,
        "captured_at": datetime.now(UTC).isoformat(),
    }


def register(
    db: Session,
    event_id: uuid.UUID,
    student: Student,
    status: RegistrationStatus = RegistrationStatus.CONFIRMED,
) -> Registration:
    reg = Registration(
        event_id=event_id,
        student_id=student.id,
        profile_snapshot=snapshot(student),
        answers={},
        status=status,
    )
    db.add(reg)
    db.flush()
    return reg


def upload(client, event_id, pdf: bytes):
    return client.post(
        f"{API}/events/{event_id}/certificate-templates",
        files={"file": ("template.pdf", pdf, "application/pdf")},
    )


def make_batch(client, event_id, template_id):
    return client.post(
        f"{API}/events/{event_id}/certificate-batches",
        json={
            "template_id": str(template_id),
            "message_subject": "Your certificate",
            "message_body": "Thanks for coming, {{name}}!",
        },
    )


def run_items(db: Session, batch_id) -> list:
    items = db.scalars(
        select(CertificateBatchItem.id).where(CertificateBatchItem.batch_id == batch_id)
    ).all()
    return [jobs.do_generate_certificate(db, item_id) for item_id in items]


def cert_jobs(enqueued) -> list[tuple]:
    return [call for call in enqueued if call[0] is jobs.generate_certificate]


@pytest.fixture
def storage(tmp_path, monkeypatch) -> LocalStorage:
    local = LocalStorage(tmp_path)
    monkeypatch.setattr(service, "get_storage", lambda: local)
    service.template_bytes.cache_clear()
    yield local
    service.template_bytes.cache_clear()


@pytest.fixture
def setup(db, client, storage):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Hack Night")
    login(client, db, president)
    return president, club, event


@pytest.fixture
def attendees(db, setup):
    _, _, event = setup
    names = ["Al", "Bhavana Ramachandran Iyer", "Chitra", "Dev"]
    return [register(db, event.id, make_student(db, name=n)) for n in names]


@pytest.fixture
def template(client, setup):
    _, _, event = setup
    response = upload(client, event.id, default_template())
    assert response.status_code == 201, response.text
    return response.json()


# --- attendance ------------------------------------------------------------------------------


def test_attendance_defaults_to_everyone_present(client, db, setup, attendees):
    _, _, event = setup
    register(db, event.id, make_student(db), RegistrationStatus.PENDING)
    response = client.get(f"{API}/events/{event.id}/attendance")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(attendees)  # the pending Registration is not listed
    assert all(entry["present"] for entry in body)
    assert set(service.attendee_registration_ids(db, event.id)) == {a.id for a in attendees}


def test_marking_absent_excludes_from_attendees(client, db, setup, attendees):
    _, _, event = setup
    absent = attendees[0]
    response = client.put(
        f"{API}/events/{event.id}/attendance",
        json={"absent_registration_ids": [str(absent.id)]},
    )
    assert response.status_code == 200
    present = {e["registration_id"]: e["present"] for e in response.json()}
    assert present[str(absent.id)] is False
    assert sum(present.values()) == len(attendees) - 1
    assert absent.id not in service.attendee_registration_ids(db, event.id)

    # Re-marking with nobody absent ticks them back.
    client.put(f"{API}/events/{event.id}/attendance", json={"absent_registration_ids": []})
    assert absent.id in service.attendee_registration_ids(db, event.id)


def test_attendance_rejects_unknown_registration(client, setup, attendees):
    _, _, event = setup
    response = client.put(
        f"{API}/events/{event.id}/attendance",
        json={"absent_registration_ids": [str(uuid.uuid4())]},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unknown_registration"


def test_outsider_gets_403(client, db, setup):
    _, _, event = setup
    login(client, db, make_student(db))
    assert client.get(f"{API}/events/{event.id}/attendance").status_code == 403
    assert upload(client, event.id, default_template()).status_code == 403


# --- templates -------------------------------------------------------------------------------


def test_upload_detects_placeholders(template, setup, storage):
    _, _, event = setup
    assert template["has_text_layer"] is True
    tags = {p["tag"]: p for p in template["placeholders"]}
    assert set(tags) == {"name", "event_name"}
    assert all(p["source"] == "detected" for p in tags.values())
    assert tags["name"]["font_size"] == pytest.approx(28)
    assert tags["name"]["align"] == "center"
    assert storage.exists(f"certificate-templates/{event.id}/{template['id']}.pdf")


def test_upload_rejects_unknown_tag_with_suggestion(client, setup):
    _, _, event = setup
    response = upload(client, event.id, template_pdf(("{{nmae}}", 28)))
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "unknown_tags"
    assert "{{name}}" in error["message"]


def test_upload_rejects_non_pdf(client, setup):
    _, _, event = setup
    response = upload(client, event.id, b"not a pdf at all")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "not_a_pdf"


def test_upload_too_large(client, setup, monkeypatch):
    _, _, event = setup
    monkeypatch.setattr(service, "read_upload", _always_too_large)
    response = upload(client, event.id, default_template())
    assert response.status_code == 413


def _always_too_large(file, max_mb):
    from app.core.errors import AppError

    raise AppError("file_too_large", "too large", 413)


def test_image_only_pdf_has_no_text_layer(client, setup):
    _, _, event = setup
    response = upload(client, event.id, image_only_pdf())
    assert response.status_code == 201
    body = response.json()
    assert body["has_text_layer"] is False
    assert body["placeholders"] == []


def _manual(tag="name", page=0):
    return {
        "tag": tag,
        "page": page,
        "x": 100,
        "y": 300,
        "w": 600,
        "h": 30,
        "font_name": "Times-Roman",
        "font_size": 24,
        "align": "center",
        "source": "manual",
    }


def test_put_placeholders_replaces_all(client, template):
    url = f"{API}/certificate-templates/{template['id']}/placeholders"
    response = client.put(url, json={"placeholders": [_manual(), _manual("certificate_id")]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert [p["tag"] for p in body["placeholders"]] == ["name", "certificate_id"]
    assert all(p["source"] == "manual" for p in body["placeholders"])


def test_put_placeholders_rejects_bad_tag_and_page(client, template):
    url = f"{API}/certificate-templates/{template['id']}/placeholders"
    bad_tag = client.put(url, json={"placeholders": [_manual("event_nam")]})
    assert bad_tag.status_code == 400
    assert bad_tag.json()["error"]["code"] == "unknown_tags"
    assert "event_name" in bad_tag.json()["error"]["message"]
    bad_page = client.put(url, json={"placeholders": [_manual(page=3)]})
    assert bad_page.status_code == 400
    assert bad_page.json()["error"]["code"] == "bad_page"


def test_preview_returns_pdf(client, template, attendees):
    response = client.get(f"{API}/certificate-templates/{template['id']}/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    pages = len(PdfReader(io.BytesIO(response.content)).pages)
    assert 2 <= pages <= 3  # longest, shortest, random (de-duplicated)


def test_preview_without_attendees_uses_sample(client, template):
    response = client.get(f"{API}/certificate-templates/{template['id']}/preview")
    assert response.status_code == 200
    assert len(PdfReader(io.BytesIO(response.content)).pages) == 1


# --- batches ---------------------------------------------------------------------------------


def test_create_batch_needs_attendees(client, setup, template):
    _, _, event = setup
    response = make_batch(client, event.id, template["id"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_attendees"


def test_batch_rejects_other_events_template(client, db, setup, template, attendees):
    president, club, _ = setup
    other = make_event(db, club, president)
    response = make_batch(client, other.id, template["id"])
    assert response.status_code == 404


def test_create_batch_enqueues_one_job_per_attendee(client, setup, template, attendees, enqueued):
    _, _, event = setup
    response = make_batch(client, event.id, template["id"])
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "running"
    assert body["total"] == body["pending"] == body["queued"] == len(attendees)
    assert len(cert_jobs(enqueued)) == len(attendees)


def test_generating_items_issues_certificates(client, db, setup, template, attendees, storage):
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    cert_ids = run_items(db, batch_id)
    assert all(cert_ids)
    certs = db.scalars(select(Certificate).where(Certificate.event_id == event.id)).all()
    assert len(certs) == len(attendees)
    assert all(c.status == CertificateStatus.VALID for c in certs)
    assert all(storage.exists(c.pdf_file_key) for c in certs)
    assert certs[0].display["event"] == "Hack Night"

    progress = client.get(f"{API}/certificate-batches/{batch_id}").json()
    assert progress["status"] == "done"
    assert progress["generated"] == len(attendees)
    assert progress["pending"] == progress["failed"] == 0


def test_running_an_item_twice_makes_no_duplicate(client, db, setup, template, attendees):
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    first = run_items(db, batch_id)
    second = run_items(db, batch_id)
    assert first == second
    count = len(db.scalars(select(Certificate.id).where(Certificate.event_id == event.id)).all())
    assert count == len(attendees)


def test_second_batch_skips_existing_holders(client, db, setup, template, attendees):
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    run_items(db, batch_id)
    again = make_batch(client, event.id, template["id"])
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_issued"


def test_retry_requeues_only_failed(client, db, setup, template, attendees, enqueued, monkeypatch):
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    items = db.scalars(
        select(CertificateBatchItem).where(CertificateBatchItem.batch_id == batch_id)
    ).all()
    bad = items[0]

    real_issue = service.issue_certificate

    def flaky(db_, *, registration, **kw):
        if registration.id == bad.registration_id:
            raise RuntimeError("render exploded")
        return real_issue(db_, registration=registration, **kw)

    monkeypatch.setattr(service, "issue_certificate", flaky)
    for item in items:
        if item.id == bad.id:
            with pytest.raises(RuntimeError):
                jobs.do_generate_certificate(db, item.id)
        else:
            jobs.do_generate_certificate(db, item.id)
    db.refresh(bad)
    assert bad.status == CertificateBatchItemStatus.FAILED
    assert "render exploded" in bad.error
    assert db.get(CertificateBatch, uuid.UUID(batch_id)).status == (
        CertificateBatchStatus.DONE_WITH_FAILURES
    )

    enqueued.clear()
    response = client.post(f"{API}/certificate-batches/{batch_id}/retry")
    assert response.status_code == 202
    assert response.json()["queued"] == 1
    assert [call[1] for call in cert_jobs(enqueued)] == [(str(bad.id),)]

    monkeypatch.setattr(service, "issue_certificate", real_issue)
    jobs.do_generate_certificate(db, bad.id)
    progress = client.get(f"{API}/certificate-batches/{batch_id}").json()
    assert progress["status"] == "done"
    assert progress["generated"] == len(attendees)

    nothing = client.post(f"{API}/certificate-batches/{batch_id}/retry")
    assert nothing.status_code == 409
    assert nothing.json()["error"]["code"] == "nothing_to_retry"


def test_late_attendee_gets_exactly_one_new_certificate(
    client, db, setup, template, attendees, enqueued
):
    _, _, event = setup
    late = attendees[0]
    client.put(
        f"{API}/events/{event.id}/attendance",
        json={"absent_registration_ids": [str(late.id)]},
    )
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    run_items(db, batch_id)
    before = {
        c.id: (c.public_id, c.status)
        for c in db.scalars(select(Certificate).where(Certificate.event_id == event.id))
    }
    assert len(before) == len(attendees) - 1

    # Not yet present: rejected.
    rejected = client.post(
        f"{API}/certificate-batches/{batch_id}/attendees",
        json={"registration_ids": [str(late.id)]},
    )
    assert rejected.status_code == 400

    client.put(f"{API}/events/{event.id}/attendance", json={"absent_registration_ids": []})
    enqueued.clear()
    response = client.post(
        f"{API}/certificate-batches/{batch_id}/attendees",
        json={"registration_ids": [str(late.id), str(attendees[1].id)]},
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["queued"] == 1 and body["skipped_existing"] == 1
    assert body["status"] == "running"
    assert len(cert_jobs(enqueued)) == 1
    run_items(db, batch_id)

    after = db.scalars(select(Certificate).where(Certificate.event_id == event.id)).all()
    assert len(after) == len(attendees)
    for c in after:
        if c.id in before:
            assert (c.public_id, c.status) == before[c.id]
    assert client.get(f"{API}/certificate-batches/{batch_id}").json()["status"] == "done"


# --- Reissue and Revoke ----------------------------------------------------------------------


@pytest.fixture
def issued(client, db, setup, template, attendees) -> Certificate:
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    run_items(db, batch_id)
    return db.scalars(select(Certificate).where(Certificate.event_id == event.id)).first()


def test_reissue_supersedes_and_links(client, db, issued, enqueued):
    registration = db.get(Registration, issued.registration_id)
    registration.profile_snapshot = {**registration.profile_snapshot, "name": "Corrected Name"}
    db.flush()
    enqueued.clear()

    response = client.post(f"{API}/certificates/{issued.id}/reissue", json={"reason": "typo"})
    assert response.status_code == 200, response.text
    new = response.json()
    assert new["public_id"] != issued.public_id
    assert new["status"] == "valid"

    db.refresh(issued)
    assert issued.status == CertificateStatus.SUPERSEDED
    assert str(issued.superseded_by) == new["id"]
    new_row = db.get(Certificate, uuid.UUID(new["id"]))
    assert new_row.display["name"] == "Corrected Name"
    assert new_row.registration_id == issued.registration_id
    assert [c[1] for c in enqueued] == [(new["id"],)]

    again = client.post(f"{API}/certificates/{issued.id}/reissue", json={"reason": "again"})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invalid_transition"


def test_revoke_and_revoke_twice(client, db, issued):
    response = client.post(f"{API}/certificates/{issued.id}/revoke", json={"reason": "fraud"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "revoked"
    assert body["revoked_reason"] == "fraud"
    assert body["superseded_by"] is None

    twice = client.post(f"{API}/certificates/{issued.id}/revoke", json={"reason": "again"})
    assert twice.status_code == 409
    assert twice.json()["error"]["code"] == "invalid_transition"


def test_outsider_cannot_touch_certificates(client, db, issued):
    login(client, db, make_student(db))
    response = client.post(f"{API}/certificates/{issued.id}/revoke", json={"reason": "x"})
    assert response.status_code == 403
    assert db.get(Certificate, issued.id).status == CertificateStatus.VALID


def test_no_update_or_delete_routes_for_certificates(client, issued):
    url = f"{API}/certificates/{issued.id}"
    assert client.delete(url).status_code in (404, 405)
    assert client.patch(url, json={}).status_code in (404, 405)
    assert client.put(url, json={}).status_code in (404, 405)
