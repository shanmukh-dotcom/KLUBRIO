"""Tables owned by events (P2): events, registration_forms, form_fields, eligibility_rules."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class FormFieldType(enum.StrEnum):
    """Matches `app.events.schemas.FormFieldType`."""

    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    NUMBER = "number"
    EMAIL = "email"
    PHONE = "phone"
    DATE = "date"
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"
    YES_NO = "yes_no"


class EligibilityField(enum.StrEnum):
    """The Student Profile fields an Eligibility Rule can test."""

    DEPARTMENT = "department"
    YEAR = "year"
    SECTION = "section"


class EligibilityOperator(enum.StrEnum):
    IN = "in"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class Event(TimestampedBase):
    """An Event run by a Club. "Open" is derived, never stored: not `manually_closed`,
    deadline not passed, Confirmed count below `seat_limit`."""

    __tablename__ = "events"

    club_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clubs.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, server_default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    venue: Mapped[str] = mapped_column(String(200), server_default="")
    approval_required: Mapped[bool] = mapped_column(server_default=text("false"))
    # Null means no Seat Limit.
    seat_limit: Mapped[int | None]
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manually_closed: Mapped[bool] = mapped_column(server_default=text("false"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"))


class RegistrationForm(TimestampedBase):
    """The one Registration Form of an Event."""

    __tablename__ = "registration_forms"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), unique=True
    )


class FormField(TimestampedBase):
    """A custom Form Field. `type` and deletion lock once any Registration answered it."""

    __tablename__ = "form_fields"
    # Also serves lookups by form_id (leading column).
    __table_args__ = (UniqueConstraint("form_id", "key"),)

    form_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registration_forms.id", ondelete="CASCADE")
    )
    # Stable; used as the key in Registration answers and in `form.<key>` Tags.
    key: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(200))
    type: Mapped[FormFieldType] = mapped_column(_enum(FormFieldType, "form_field_type"))
    required: Mapped[bool] = mapped_column(server_default=text("false"))
    help_text: Mapped[str] = mapped_column(Text, server_default="")
    # Choice labels for single_choice / multi_choice; empty otherwise.
    options: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    position: Mapped[int]
    hidden: Mapped[bool] = mapped_column(server_default=text("false"))


class EligibilityRule(TimestampedBase):
    """All of an Event's rules are ANDed together."""

    __tablename__ = "eligibility_rules"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    field: Mapped[EligibilityField] = mapped_column(_enum(EligibilityField, "eligibility_field"))
    operator: Mapped[EligibilityOperator] = mapped_column(
        _enum(EligibilityOperator, "eligibility_operator"),
        server_default=EligibilityOperator.IN.value,
    )
    values: Mapped[list[Any]] = mapped_column(JSONB)
