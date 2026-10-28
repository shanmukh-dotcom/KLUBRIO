"""Tables owned by certificates (P4): attendance, certificate_templates, placeholders,
certificate_batches, certificate_batch_items, certificates."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class PlaceholderAlign(enum.StrEnum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class PlaceholderSource(enum.StrEnum):
    # Found from a `{{tag}}` in the template's text layer.
    DETECTED = "detected"
    # Drawn by hand (templates with no text layer, or extra fields).
    MANUAL = "manual"


class CertificateBatchStatus(enum.StrEnum):
    RUNNING = "running"
    DONE = "done"
    DONE_WITH_FAILURES = "done_with_failures"


class CertificateBatchItemStatus(enum.StrEnum):
    """`pending -> generated | failed`; `failed -> pending` (retry)."""

    PENDING = "pending"
    GENERATED = "generated"
    FAILED = "failed"


class CertificateStatus(enum.StrEnum):
    """Matches `app.certificates.schemas.CertificateStatus`. `valid -> superseded`
    (Reissue) or `valid -> revoked`; no other transitions (ADR 0001)."""

    VALID = "valid"
    SUPERSEDED = "superseded"
    REVOKED = "revoked"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class Attendance(TimestampedBase):
    """Everyone starts present; the Club unticks no-shows. Present rows are Attendees."""

    __tablename__ = "attendance"

    registration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registrations.id", ondelete="RESTRICT"), unique=True
    )
    present: Mapped[bool] = mapped_column(server_default=text("true"))
    # Null until someone changes the default tick.
    marked_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT")
    )
    marked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CertificateTemplate(TimestampedBase):
    __tablename__ = "certificate_templates"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    file_key: Mapped[str] = mapped_column(String(500))
    has_text_layer: Mapped[bool] = mapped_column(server_default=text("false"))


class Placeholder(TimestampedBase):
    """Where a Tag's value is written on the template. Coordinates in PDF points."""

    __tablename__ = "placeholders"

    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificate_templates.id", ondelete="CASCADE"), index=True
    )
    # e.g. `name`, `form.team_name`.
    tag: Mapped[str] = mapped_column(String(100))
    page: Mapped[int]
    x: Mapped[float]
    y: Mapped[float]
    w: Mapped[float]
    h: Mapped[float]
    font_name: Mapped[str] = mapped_column(String(100))
    font_size: Mapped[float]
    align: Mapped[PlaceholderAlign] = mapped_column(
        _enum(PlaceholderAlign, "placeholder_align"), server_default=PlaceholderAlign.CENTER.value
    )
    source: Mapped[PlaceholderSource] = mapped_column(
        _enum(PlaceholderSource, "placeholder_source"),
        server_default=PlaceholderSource.MANUAL.value,
    )


class CertificateBatch(TimestampedBase):
    __tablename__ = "certificate_batches"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), index=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificate_templates.id", ondelete="RESTRICT"), index=True
    )
    # The Club's message for the Certificate Notification email.
    message_subject: Mapped[str] = mapped_column(String(200))
    message_body: Mapped[str] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"))
    status: Mapped[CertificateBatchStatus] = mapped_column(
        _enum(CertificateBatchStatus, "certificate_batch_status"),
        server_default=CertificateBatchStatus.RUNNING.value,
    )


class CertificateBatchItem(TimestampedBase):
    """One row per Attendee per batch; the unique pair keeps retries idempotent."""

    __tablename__ = "certificate_batch_items"
    # Also serves lookups by batch_id (leading column).
    __table_args__ = (UniqueConstraint("batch_id", "registration_id"),)

    batch_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificate_batches.id", ondelete="RESTRICT")
    )
    registration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registrations.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[CertificateBatchItemStatus] = mapped_column(
        _enum(CertificateBatchItemStatus, "certificate_batch_item_status"),
        server_default=CertificateBatchItemStatus.PENDING.value,
    )
    attempts: Mapped[int] = mapped_column(server_default=text("0"))
    error: Mapped[str | None] = mapped_column(Text)
    # Set once the Certificate is generated.
    certificate_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certificates.id", ondelete="RESTRICT"), index=True
    )


class Certificate(TimestampedBase):
    """Never edited or deleted (ADR 0001): rows are inserted, then only change status."""

    __tablename__ = "certificates"

    # Certificate ID, `ORG-XXXX-XXXX` (app/certificates/ids.py).
    public_id: Mapped[str] = mapped_column(String(20), unique=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT"), index=True
    )
    registration_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registrations.id", ondelete="RESTRICT"), index=True
    )
    # Null for a Certificate created by Reissue outside a batch.
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certificate_batches.id", ondelete="RESTRICT"), index=True
    )
    pdf_file_key: Mapped[str] = mapped_column(String(500))
    # Frozen at issue: {"name", "event", "club", "date"}, as shown on the Verification Page.
    display: Mapped[dict[str, Any]] = mapped_column(JSONB)
    status: Mapped[CertificateStatus] = mapped_column(
        _enum(CertificateStatus, "certificate_status"),
        server_default=CertificateStatus.VALID.value,
    )
    superseded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("certificates.id", ondelete="RESTRICT")
    )
    revoked_reason: Mapped[str | None] = mapped_column(Text)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
