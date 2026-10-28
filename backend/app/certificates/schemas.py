"""Request/response models for Attendance and Certificates (P4)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CertificateStatus = Literal["valid", "superseded", "revoked"]


class AttendanceEntry(BaseModel):
    registration_id: uuid.UUID
    name: str
    roll_no: str
    present: bool


class AttendanceUpdate(BaseModel):
    """Registrations to mark absent. Everyone else stays present (the default)."""

    absent_registration_ids: list[uuid.UUID]


class Placeholder(BaseModel):
    tag: str = Field(max_length=100, examples=["name", "form.team_name"])
    page: int = Field(ge=0)
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    font_name: str = Field(max_length=100)
    font_size: float = Field(gt=0)
    align: Literal["left", "center", "right"] = "center"
    source: Literal["detected", "manual"] = "manual"


class PlaceholdersIn(BaseModel):
    placeholders: list[Placeholder]


class CertificateTemplateOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    has_text_layer: bool
    # Pages in the template; Placeholder `page` must be below this.
    page_count: int = 1
    placeholders: list[Placeholder]


class CertificateBatchCreate(BaseModel):
    template_id: uuid.UUID
    message_subject: str = Field(max_length=200)
    message_body: str


class CertificateBatchOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    template_id: uuid.UUID | None = None
    status: Literal["running", "done", "done_with_failures"]
    total: int
    generated: int
    failed: int
    pending: int
    # Attendees left out of this request because they already hold a valid Certificate
    # for the Event (R29). Only set by create and add-late-Attendees.
    skipped_existing: int = 0
    # Items added by this request (create and add-late-Attendees) or re-queued (retry).
    queued: int = 0


class LateAttendeesIn(BaseModel):
    """Registrations newly marked present after the batch ran (R29)."""

    registration_ids: list[uuid.UUID] = Field(min_length=1)


class ReissueRequest(BaseModel):
    reason: str = Field(min_length=1)


class RevokeRequest(BaseModel):
    reason: str = Field(min_length=1)


class CertificateOut(BaseModel):
    id: uuid.UUID
    public_id: str
    event_id: uuid.UUID
    status: CertificateStatus
    superseded_by: uuid.UUID | None
    issued_at: datetime
    revoked_reason: str | None = None
    revoked_at: datetime | None = None
