"""Certificate Notifications (P5; R37, ADR 0002, domain rule 4)."""

import uuid

import pytest
from sqlalchemy import select

from app.certificates.ids import new_certificate_id
from app.certificates.models import (
    Certificate,
    CertificateBatch,
    CertificateStatus,
    CertificateTemplate,
)
from app.core.email import EmailMessage
from app.notifications.jobs import do_send_certificate_notification
from app.notifications.models import CertificateNotification, CertificateNotificationStatus
from app.notifications.service import (
    build_message_values,
    compose_notification,
    render_message,
)
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import make_club, make_event, make_student

# --------------------------------------------------------------------------- pure

VALUES = build_message_values(
    profile_snapshot={
        "name": "Snapshot Name",
        "roll_no": "21CS001",
        "department": "CSE",
        "year": 3,
        "section": "B",
    },
    answers={"team_name": "Rockets", "tracks": ["AI", "Web"]},
    display={"name": "Asha Rao", "event": "Hackfest", "club": "Coding Club", "date": "2026-11-02"},
    public_id="ORG-7KQ2-M9XD",
)


def test_render_profile_tags():
    text = render_message("{{roll_no}} {{department}} {{year}} {{section}}", VALUES)
    assert text == "21CS001 CSE 3 B"


def test_render_name_comes_from_certificate_display():
    assert render_message("Hi {{name}}", VALUES) == "Hi Asha Rao"


def test_render_event_and_certificate_tags():
    text = render_message(
        "{{event_name}} by {{club_name}} on {{event_date}}: {{certificate_id}}", VALUES
    )
    assert text == "Hackfest by Coding Club on 2026-11-02: ORG-7KQ2-M9XD"


def test_render_form_tags_and_spaces_inside_braces():
    assert render_message("{{ form.team_name }} / {{form.tracks}}", VALUES) == "Rockets / AI, Web"


def test_render_leaves_unknown_tags_as_written():
    text = render_message("{{nickname}} {{form.missing}} {{ name }}", VALUES)
    assert text == "{{nickname}} {{form.missing}} Asha Rao"


def test_compose_appends_links_and_no_attachment(monkeypatch):
    from types import SimpleNamespace

    from app.notifications import service

    fake = SimpleNamespace(frontend_base_url="https://orgniser.example/")
    monkeypatch.setattr(service, "get_settings", lambda: fake)
    content = compose_notification("Your {{event_name}}", "Hello {{name}}", VALUES, "ORG-7KQ2-M9XD")
    assert content.subject == "Your Hackfest"
    assert content.text.startswith("Hello Asha Rao")
    assert "https://orgniser.example/me/certificates" in content.text
    assert "https://orgniser.example/verify/ORG-7KQ2-M9XD" in content.text
    # EmailMessage has no attachment field at all (ADR 0002).
    assert not hasattr(EmailMessage("a@b.c", "s", "t"), "attachments")


# --------------------------------------------------------------------------- DB


class FakeSender:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> str:
        self.sent.append(message)
        return f"msg-{len(self.sent)}"


class FailingSender:
    def send(self, message: EmailMessage) -> str:
        raise RuntimeError("SMTP down")


def make_certificate(db, *, status=CertificateStatus.VALID, with_batch=True, student=None):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Hackfest")
    student = student or make_student(db, email=f"holder{uuid.uuid4().hex[:6]}@example.com")
    registration = Registration(
        event_id=event.id,
        student_id=student.id,
        profile_snapshot={"name": student.name, "roll_no": student.roll_no},
        answers={"team_name": "Rockets"},
        status=RegistrationStatus.CONFIRMED,
    )
    db.add(registration)
    db.flush()
    batch_id = None
    if with_batch:
        template = CertificateTemplate(event_id=event.id, file_key="templates/t.pdf")
        db.add(template)
        db.flush()
        batch = CertificateBatch(
            event_id=event.id,
            template_id=template.id,
            message_subject="Your {{event_name}} certificate",
            message_body="Well done {{name}} of team {{form.team_name}}!",
            created_by=president.id,
        )
        db.add(batch)
        db.flush()
        batch_id = batch.id
    cert = Certificate(
        public_id=new_certificate_id(),
        event_id=event.id,
        student_id=student.id,
        registration_id=registration.id,
        batch_id=batch_id,
        pdf_file_key=f"certificates/{uuid.uuid4().hex}.pdf",
        display={
            "name": student.name,
            "event": "Hackfest",
            "club": "Test Club",
            "date": "2026-11-02",
        },
        status=status,
    )
    db.add(cert)
    db.flush()
    return cert, student


def _notification(db, cert):
    return db.scalars(
        select(CertificateNotification).where(CertificateNotification.certificate_id == cert.id)
    ).one_or_none()


def test_job_sends_exactly_one_email_even_when_run_twice(db):
    cert, student = make_certificate(db)
    sender = FakeSender()
    do_send_certificate_notification(db, cert.id, sender=sender)
    do_send_certificate_notification(db, cert.id, sender=sender)

    assert len(sender.sent) == 1
    message = sender.sent[0]
    assert message.to == student.email
    assert message.subject == "Your Hackfest certificate"
    assert f"Well done {student.name} of team Rockets!" in message.text
    assert "/me/certificates" in message.text
    assert f"/verify/{cert.public_id}" in message.text

    row = _notification(db, cert)
    assert row.status == CertificateNotificationStatus.SENT
    assert row.provider_message_id == "msg-1"
    assert row.attempts == 1
    assert row.sent_at is not None


def test_job_without_batch_uses_default_message(db):
    cert, _ = make_certificate(db, with_batch=False)
    sender = FakeSender()
    do_send_certificate_notification(db, cert.id, sender=sender)
    assert len(sender.sent) == 1
    assert "Hackfest" in sender.sent[0].subject
    assert cert.public_id in sender.sent[0].text


def test_failing_sender_marks_failed_and_leaves_certificate_alone(db):
    cert, _ = make_certificate(db)
    before = (cert.status, cert.updated_at, dict(cert.display))
    with pytest.raises(RuntimeError):
        do_send_certificate_notification(db, cert.id, sender=FailingSender())

    row = _notification(db, cert)
    assert row.status == CertificateNotificationStatus.FAILED
    assert "SMTP down" in row.error
    assert row.attempts == 1
    db.refresh(cert)
    assert (cert.status, cert.updated_at, dict(cert.display)) == before

    # A retry after a failure does send.
    sender = FakeSender()
    do_send_certificate_notification(db, cert.id, sender=sender)
    assert len(sender.sent) == 1
    assert _notification(db, cert).attempts == 2


def test_revoked_certificate_is_skipped(db):
    cert, _ = make_certificate(db, status=CertificateStatus.REVOKED)
    sender = FakeSender()
    do_send_certificate_notification(db, cert.id, sender=sender)
    assert sender.sent == []


def test_webhook_marks_bounced(db, client):
    cert, _ = make_certificate(db)
    do_send_certificate_notification(db, cert.id, sender=FakeSender())

    response = client.post(
        "/api/v1/webhooks/email", json={"message_id": "msg-1", "event": "bounced"}
    )
    assert response.status_code == 204
    row = _notification(db, cert)
    db.refresh(row)
    assert row.status == CertificateNotificationStatus.BOUNCED
    db.refresh(cert)
    assert cert.status == CertificateStatus.VALID


def test_webhook_unknown_message_id_is_204(db, client):
    response = client.post(
        "/api/v1/webhooks/email", json={"message_id": "nope", "event": "delivered"}
    )
    assert response.status_code == 204


def test_webhook_rejects_wrong_secret(db, client, monkeypatch):
    monkeypatch.setenv("ORGNISER_EMAIL_WEBHOOK_SECRET", "s3cret")
    body = {"message_id": "x", "event": "bounced"}
    assert client.post("/api/v1/webhooks/email", json=body).status_code == 401
    wrong = client.post("/api/v1/webhooks/email", json=body, headers={"X-Webhook-Secret": "no"})
    assert wrong.status_code == 401
    right = client.post("/api/v1/webhooks/email", json=body, headers={"X-Webhook-Secret": "s3cret"})
    assert right.status_code == 204
