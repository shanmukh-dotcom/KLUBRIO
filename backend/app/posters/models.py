"""Tables owned by posters (P3): posters, qr_areas."""

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class PosterRenderStatus(enum.StrEnum):
    """Matches `app.posters.schemas.RenderStatus`."""

    NONE = "none"
    QUEUED = "queued"
    DONE = "done"
    FAILED = "failed"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class Poster(TimestampedBase):
    """An uploaded Poster and, once rendered, its Final Poster files."""

    __tablename__ = "posters"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    original_file_key: Mapped[str] = mapped_column(String(500))
    width_px: Mapped[int]
    height_px: Mapped[int]
    final_png_key: Mapped[str | None] = mapped_column(String(500))
    final_pdf_key: Mapped[str | None] = mapped_column(String(500))
    render_status: Mapped[PosterRenderStatus] = mapped_column(
        _enum(PosterRenderStatus, "poster_render_status"),
        server_default=PosterRenderStatus.NONE.value,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="RESTRICT"))


class QrArea(TimestampedBase):
    """The QR Area the President marked: a pixel box on the original Poster."""

    __tablename__ = "qr_areas"

    poster_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("posters.id", ondelete="CASCADE"), unique=True
    )
    x: Mapped[int]
    y: Mapped[int]
    w: Mapped[int]
    h: Mapped[int]
