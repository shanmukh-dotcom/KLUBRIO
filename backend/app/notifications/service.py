"""Certificate Notification logic (P5; R37, ADR 0002).

`render_message` is pure. `build_message_values` and `compose_notification` turn a
Certificate and its Registration into the email; nothing here sends or writes rows.
"""

import re
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.certificates.models import Certificate, CertificateBatch
from app.core.email import EmailMessage
from app.core.settings import get_settings
from app.notifications.models import CertificateNotification, CertificateNotificationStatus
from app.registrations.models import Registration

# Same shape as Certificate Template Tags (`{{ name }}`, `{{form.team_name}}`).
TAG_PATTERN = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")
PROFILE_KEYS = ("name", "roll_no", "department", "year", "section")
FORM_PREFIX = "form."

DEFAULT_SUBJECT = "Your certificate for {{event_name}} is ready"
DEFAULT_BODY = (
    "Hi {{name}},\n\n"
    "Your certificate for {{event_name}}, run by {{club_name}}, is now in your ORGniser "
    "account.\n\nCertificate ID: {{certificate_id}}"
)


def render_message(template: str, values: Mapping[str, Any]) -> str:
    """Replace each `{{tag}}` with `values[tag]`. Spaces inside the braces are ignored.
    Unknown tags, and tags whose value is None, are left exactly as written."""

    def replace(match: re.Match[str]) -> str:
        tag = re.sub(r"\s+", "", match.group(1))
        value = values.get(tag)
        return match.group(0) if value is None else str(value)

    return TAG_PATTERN.sub(replace, template)


def build_message_values(
    *,
    profile_snapshot: Mapping[str, Any] | None,
    answers: Mapping[str, Any] | None,
    display: Mapping[str, Any] | None,
    public_id: str,
) -> dict[str, Any]:
    """The Supported Tag values (DESIGN.md §2) for one Certificate Notification."""
    snapshot = profile_snapshot or {}
    shown = display or {}
    values: dict[str, Any] = {key: snapshot.get(key) for key in PROFILE_KEYS}
    # The name as frozen on the Certificate wins; it is what the Student will see.
    if shown.get("name"):
        values["name"] = shown["name"]
    values["event_name"] = shown.get("event")
    values["club_name"] = shown.get("club")
    values["event_date"] = shown.get("date")
    values["certificate_id"] = public_id
    for key, answer in (answers or {}).items():
        if isinstance(answer, list):
            answer = ", ".join(str(a) for a in answer)
        values[FORM_PREFIX + key] = answer
    return values


def my_certificates_url() -> str:
    return f"{get_settings().frontend_base_url.rstrip('/')}/me/certificates"


def verification_url(public_id: str) -> str:
    return f"{get_settings().frontend_base_url.rstrip('/')}/verify/{public_id}"


@dataclass(frozen=True)
class NotificationContent:
    subject: str
    text: str


def compose_notification(
    subject_template: str, body_template: str, values: Mapping[str, Any], public_id: str
) -> NotificationContent:
    """Render the Club's message and append the account and verification links.
    Never an attachment: the Certificate is delivered in the account (ADR 0002)."""
    subject = " ".join(render_message(subject_template, values).split())
    body = render_message(body_template, values).rstrip()
    text = (
        f"{body}\n\n"
        f"Download it from My Certificates (log in first): {my_certificates_url()}\n"
        f"Anyone can check it is genuine at: {verification_url(public_id)}\n"
    )
    return NotificationContent(subject=subject, text=text)


def notification_for(db: Session, certificate: Certificate, to: str) -> EmailMessage:
    """The Certificate Notification email for `certificate`, addressed to `to`."""
    registration = db.get(Registration, certificate.registration_id)
    batch = db.get(CertificateBatch, certificate.batch_id) if certificate.batch_id else None
    subject_template = batch.message_subject if batch else DEFAULT_SUBJECT
    body_template = batch.message_body if batch else DEFAULT_BODY
    values = build_message_values(
        profile_snapshot=registration.profile_snapshot if registration else None,
        answers=registration.answers if registration else None,
        display=certificate.display,
        public_id=certificate.public_id,
    )
    content = compose_notification(subject_template, body_template, values, certificate.public_id)
    return EmailMessage(to=to, subject=content.subject, text=content.text)


def get_or_create_notification(db: Session, certificate_id: uuid.UUID) -> CertificateNotification:
    """The one `certificate_notifications` row for a Certificate, locked for this run.

    Uses INSERT .. ON CONFLICT DO NOTHING, so two workers racing on the same Certificate
    still end up with one row (the unique constraint on `certificate_id`).
    """
    db.execute(
        insert(CertificateNotification)
        .values(certificate_id=certificate_id)
        .on_conflict_do_nothing(index_elements=["certificate_id"])
    )
    return db.scalars(
        select(CertificateNotification)
        .where(CertificateNotification.certificate_id == certificate_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).one()


# Webhook events from the email provider (decision 34), mapped to notification status.
WEBHOOK_EVENTS = ("delivered", "bounced", "failed")


def apply_email_event(db: Session, message_id: str, event: str) -> bool:
    """Apply one provider event to the matching notification row. Returns False when no
    row has that message id. Only `certificate_notifications` is written, never the
    Certificate (R37)."""
    notification = db.scalars(
        select(CertificateNotification).where(
            CertificateNotification.provider_message_id == message_id
        )
    ).first()
    if notification is None:
        return False
    if event == "bounced":
        notification.status = CertificateNotificationStatus.BOUNCED
    elif event == "failed":
        notification.status = CertificateNotificationStatus.FAILED
    # "delivered": the row is already `sent`; nothing to change.
    db.flush()
    return True
