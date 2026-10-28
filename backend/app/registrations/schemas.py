"""Request/response models for Registrations (P2)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

RegistrationStatus = Literal["pending", "confirmed", "rejected", "cancelled"]


class RegistrationIn(BaseModel):
    """Answers keyed by Form Field `key`. The Profile Snapshot is taken server-side."""

    answers: dict[str, Any]


class RegistrationOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    student_id: uuid.UUID
    profile_snapshot: dict[str, Any]
    answers: dict[str, Any]
    status: RegistrationStatus
    submitted_at: datetime
    decided_at: datetime | None
    # Who approved or rejected it (a President or Coordinator); null until decided.
    decided_by: uuid.UUID | None = None
