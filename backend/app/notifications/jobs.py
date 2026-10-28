"""Certificate Notification job (P5; R37, ADR 0002, RULES.md domain rule 4).

Certificate generation enqueues it once per new Certificate:

    enqueue(send_certificate_notification, str(cert.id), job_id=f"notify-{cert.id}")

`do_send_certificate_notification(db, ...)` is the testable core; `send_certificate_notification`
is the RQ entry point. The job is idempotent: one `certificate_notifications` row per
Certificate, and a row already `sent` or `bounced` is never sent again. It only ever
writes that row: a failed email never touches the Certificate.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.certificates.models import Certificate, CertificateStatus
from app.core.email import EmailSender, get_email_sender
from app.jobs.queue import job_session
from app.notifications.models import CertificateNotificationStatus
from app.notifications.service import get_or_create_notification, notification_for

logger = logging.getLogger(__name__)

_DONE = (CertificateNotificationStatus.SENT, CertificateNotificationStatus.BOUNCED)
# Long provider errors are cut so one bad send can't bloat the row.
_MAX_ERROR = 2000


def do_send_certificate_notification(
    db: Session, certificate_id: uuid.UUID, sender: EmailSender | None = None
) -> None:
    """Send the Certificate Notification for one Certificate, at most once.

    Skips unknown and revoked Certificates. On a send failure the row is marked `failed`
    (flushed, not committed) and the exception is re-raised; the caller commits the row
    before letting the failure reach RQ.
    """
    certificate = db.get(Certificate, certificate_id)
    if certificate is None:
        logger.warning("Certificate %s not found; notification skipped.", certificate_id)
        return
    if certificate.status == CertificateStatus.REVOKED:
        logger.info("Certificate %s is revoked; notification skipped.", certificate.public_id)
        return

    notification = get_or_create_notification(db, certificate.id)
    if notification.status in _DONE:
        return

    student = db.get(Student, certificate.student_id)
    if student is None:  # pragma: no cover - FK makes this impossible
        logger.warning("Student for certificate %s not found.", certificate.public_id)
        return

    message = notification_for(db, certificate, student.email)
    sender = sender or get_email_sender()
    notification.attempts = (notification.attempts or 0) + 1
    try:
        message_id = sender.send(message)
    except Exception as exc:
        notification.status = CertificateNotificationStatus.FAILED
        notification.error = f"{type(exc).__name__}: {exc}"[:_MAX_ERROR]
        db.flush()
        raise
    notification.status = CertificateNotificationStatus.SENT
    notification.provider_message_id = message_id
    notification.sent_at = datetime.now(UTC)
    notification.error = None
    db.flush()


def send_certificate_notification(certificate_id: str) -> None:
    """RQ entry point. Commits the `failed` row before re-raising, so RQ records the
    failure and the attempt is still counted."""
    with job_session() as db:
        try:
            do_send_certificate_notification(db, uuid.UUID(certificate_id))
        except Exception:
            db.commit()
            raise
