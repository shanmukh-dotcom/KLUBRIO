"""Tables owned by registrations (P2): registrations."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class RegistrationStatus(enum.StrEnum):
    """Matches `app.registrations.schemas.RegistrationStatus`. Transitions: DESIGN.md §5."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class Registration(TimestampedBase):
    """One per Student per Event. Re-registering after Cancellation reuses this row."""

    __tablename__ = "registrations"
    # Also serves lookups by event_id (leading column).
    __table_args__ = (UniqueConstraint("event_id", "student_id"),)

    # RESTRICT: Registrations are history and must keep their Event and owner.
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="RESTRICT"))
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT"), index=True
    )
    profile_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Keyed by `form_fields.key`.
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    status: Mapped[RegistrationStatus] = mapped_column(
        _enum(RegistrationStatus, "registration_status")
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT")
    )
