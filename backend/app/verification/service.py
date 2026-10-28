"""Verification Page and My Certificates (P5; R36, R38, R39, R42, domain rule 8).

Reads `certificates` (owned by P4) and never writes it. Everything shown comes from
`certificate.display`, frozen at issue, so later profile edits never change a Certificate.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.accounts.models import Student
from app.certificates.ids import normalise_certificate_id
from app.certificates.models import Certificate, CertificateStatus
from app.core.errors import AppError
from app.core.storage import StorageNotFound, get_storage
from app.events.models import Event
from app.verification.schemas import MyCertificateOut, VerificationOut

NOT_FOUND_MESSAGE = (
    "No Certificate has this ID. Check it was typed exactly as printed (ORG-XXXX-XXXX). "
    "Certificates are never deleted, so an ID that isn't found is not a genuine Certificate."
)


def _not_found() -> AppError:
    return AppError("certificate_not_found", NOT_FOUND_MESSAGE, 404)


def parse_display_date(value: Any) -> date | None:
    """`display["date"]` as a date. Accepts a date, a datetime or an ISO string."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _event_date(db: Session, certificate: Certificate) -> date:
    shown = parse_display_date((certificate.display or {}).get("date"))
    if shown is not None:
        return shown
    # Fallback when the display has no usable date: the Event's start date.
    event = db.get(Event, certificate.event_id)
    if event is None:  # pragma: no cover - the foreign key makes this impossible
        raise _not_found()
    return event.starts_at.date()


def _superseded_public_id(
    certificate: Certificate, replacement_public_id: str | None
) -> str | None:
    if certificate.status == CertificateStatus.SUPERSEDED:
        return replacement_public_id
    return None


def verify_certificate(db: Session, raw_public_id: str) -> VerificationOut:
    """Public lookup by Certificate ID. Unparseable and unknown IDs give the same 404 (R42)."""
    public_id = normalise_certificate_id(raw_public_id)
    if public_id is None:
        raise _not_found()
    replacement = aliased(Certificate)
    row = db.execute(
        select(Certificate, replacement.public_id)
        .outerjoin(replacement, replacement.id == Certificate.superseded_by)
        .where(Certificate.public_id == public_id)
    ).first()
    if row is None:
        raise _not_found()
    certificate, replacement_public_id = row
    display = certificate.display or {}
    revoked = certificate.status == CertificateStatus.REVOKED
    return VerificationOut(
        public_id=certificate.public_id,
        name=str(display.get("name", "")),
        event_name=str(display.get("event", "")),
        club_name=str(display.get("club", "")),
        event_date=_event_date(db, certificate),
        status=certificate.status.value,
        superseded_by=_superseded_public_id(certificate, replacement_public_id),
        revoked_reason=certificate.revoked_reason if revoked else None,
        revoked_at=certificate.revoked_at if revoked else None,
    )


def list_my_certificates(db: Session, student: Student) -> list[MyCertificateOut]:
    """Every Certificate of `student`, newest first, all statuses (R36)."""
    replacement = aliased(Certificate)
    rows = db.execute(
        select(Certificate, replacement.public_id)
        .outerjoin(replacement, replacement.id == Certificate.superseded_by)
        .where(Certificate.student_id == student.id)
        .order_by(Certificate.issued_at.desc(), Certificate.created_at.desc())
    ).all()
    out: list[MyCertificateOut] = []
    for certificate, replacement_public_id in rows:
        display = certificate.display or {}
        out.append(
            MyCertificateOut(
                id=certificate.id,
                public_id=certificate.public_id,
                event_name=str(display.get("event", "")),
                club_name=str(display.get("club", "")),
                event_date=_event_date(db, certificate),
                status=certificate.status.value,
                issued_at=certificate.issued_at,
                superseded_by_public_id=_superseded_public_id(certificate, replacement_public_id),
            )
        )
    return out


def load_my_certificate_pdf(
    db: Session, student: Student, certificate_id: uuid.UUID
) -> tuple[Certificate, bytes]:
    """The owner's Certificate and its PDF bytes. Anyone else gets the same 404 as an
    unknown id, so the response never reveals that the Certificate exists (R38)."""
    certificate = db.get(Certificate, certificate_id)
    if certificate is None or certificate.student_id != student.id:
        raise AppError(
            "certificate_not_found",
            "You have no Certificate with this id. Pick one from My Certificates.",
            404,
        )
    try:
        data = get_storage().get(certificate.pdf_file_key)
    except StorageNotFound as exc:
        raise AppError(
            "certificate_file_missing",
            "This Certificate's PDF could not be found. Ask the Club to Reissue it.",
            404,
        ) from exc
    return certificate, data
