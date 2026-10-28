"""The `generate_certificate` job (P4, R34, R35): issue one Certificate for one batch item.

Idempotent (RULES.md, engineering rule 4): the item row is locked, and an item already
`generated` returns its existing Certificate without rendering again. Follows the convention
in `app.jobs.queue`: `do_generate_certificate(db, ...)` is the testable core and
`generate_certificate(...)` is the RQ entry point.

The Certificate Notification is queued by the entry point only after the Certificate has
committed, as its own job, so a failed email can never affect a Certificate (rule 4).
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.certificates import service
from app.certificates.models import (
    CertificateBatch,
    CertificateBatchItem,
    CertificateBatchItemStatus,
    CertificateTemplate,
)
from app.jobs import queue
from app.jobs.queue import job_session
from app.registrations.models import Registration

logger = logging.getLogger(__name__)

_MAX_ERROR = 2000
NOT_ATTENDEE = "no longer an Attendee"


class _NotAttendee(Exception):
    """The Registration stopped being an Attendee after the batch was created."""


def _lock_item(db: Session, item_id: uuid.UUID) -> CertificateBatchItem | None:
    return db.scalar(
        select(CertificateBatchItem)
        .where(CertificateBatchItem.id == item_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def _mark_failed(db: Session, item: CertificateBatchItem, error: str) -> None:
    item.status = CertificateBatchItemStatus.FAILED
    item.error = error[:_MAX_ERROR]
    item.attempts = (item.attempts or 0) + 1
    db.flush()
    service.refresh_batch_status(db, item.batch_id)


def do_generate_certificate(db: Session, batch_item_id: uuid.UUID) -> uuid.UUID | None:
    """Generate the Certificate for one batch item inside `db` (flushes, doesn't commit).

    Returns the new Certificate's id, the existing one if the item was already generated,
    or None when the item doesn't exist. A Registration that is no longer an Attendee marks
    the item failed and returns None. Any other error undoes the attempt (savepoint), marks
    the item failed (flushed) and re-raises; the entry point commits that before RQ sees it.
    """
    item = _lock_item(db, uuid.UUID(str(batch_item_id)))
    if item is None:
        return None
    if item.status == CertificateBatchItemStatus.GENERATED:
        return item.certificate_id

    item_id = item.id
    try:
        # A savepoint, so a failure undoes only this attempt and the item stays locked.
        with db.begin_nested():
            batch = db.get(CertificateBatch, item.batch_id)
            template = db.get(CertificateTemplate, batch.template_id)
            registration = db.get(Registration, item.registration_id)
            attendees = set(service.attendee_registration_ids(db, batch.event_id))
            if registration is None or registration.id not in attendees:
                raise _NotAttendee(NOT_ATTENDEE)
            ctx = service.event_context(db, batch.event_id)
            cert = service.issue_certificate(
                db, registration=registration, ctx=ctx, template=template, batch_id=batch.id
            )
            db.flush()
            item.status = CertificateBatchItemStatus.GENERATED
            item.certificate_id = cert.id
            item.error = None
            item.attempts = (item.attempts or 0) + 1
            db.flush()
    except _NotAttendee as exc:
        _mark_failed(db, _lock_item(db, item_id), str(exc))
        return None
    except Exception as exc:
        _mark_failed(db, _lock_item(db, item_id), f"{type(exc).__name__}: {exc}")
        raise
    service.refresh_batch_status(db, item.batch_id)
    return cert.id


def generate_certificate(item_id: str) -> None:
    """RQ entry point, queued once per batch item by create, retry and late Attendees."""
    from app.notifications.jobs import send_certificate_notification

    with job_session() as db:
        item = db.get(CertificateBatchItem, uuid.UUID(item_id))
        was_generated = item is not None and item.status == CertificateBatchItemStatus.GENERATED
        try:
            cert_id = do_generate_certificate(db, uuid.UUID(item_id))
        except Exception:
            # Commit the item's `failed` status before RQ sees the error.
            db.commit()
            raise
    # After commit, as its own job: a failed email never touches the Certificate.
    if cert_id is not None and not was_generated:
        queue.enqueue(send_certificate_notification, str(cert_id), job_id=f"notify-{cert_id}")
