"""Request/response models for Event QR and Posters (P3)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

RenderStatus = Literal["none", "queued", "done", "failed"]


class QrArea(BaseModel):
    """Pixel box on the **original** poster (not the preview) where the Event QR goes.

    Origin is the top-left corner. Convert a box drawn on the preview with
    `original = round(preview / X-Preview-Scale)`. The shorter side must be at least 300 px
    (2.5 cm at 300 DPI) and the box at most 1.5 times longer than it is wide.
    """

    x: int = Field(ge=0, description="Left edge, in original-poster pixels.")
    y: int = Field(ge=0, description="Top edge, in original-poster pixels.")
    w: int = Field(gt=0, description="Width, in original-poster pixels.")
    h: int = Field(gt=0, description="Height, in original-poster pixels.")


class PosterOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    width_px: int = Field(description="Original width; PDFs are measured at 300 DPI.")
    height_px: int = Field(description="Original height; PDFs are measured at 300 DPI.")
    qr_area: QrArea | None
    render_status: RenderStatus
