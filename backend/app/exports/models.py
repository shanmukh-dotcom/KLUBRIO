"""Tables owned by exports (P6): exports (the export log)."""

import enum
import uuid

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class ExportFormat(enum.StrEnum):
    CSV = "csv"
    XLSX = "xlsx"


class ExportFilter(enum.StrEnum):
    ALL = "all"
    CONFIRMED = "confirmed"
    ATTENDEES = "attendees"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class Export(TimestampedBase):
    """One row per export download; `created_at` is when it was requested."""

    __tablename__ = "exports"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="RESTRICT"), index=True
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"))
    format: Mapped[ExportFormat] = mapped_column(_enum(ExportFormat, "export_format"))
    filter: Mapped[ExportFilter] = mapped_column(_enum(ExportFilter, "export_filter"))
