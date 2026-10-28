"""Request/response models for verification and My Certificates (P5)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class VerificationOut(BaseModel):
    """Public, no auth. Only these fields, ever.

    Never roll number, email or form answers (RULES.md, domain rule 8).
    """

    public_id: str
    name: str
    event_name: str
    club_name: str
    event_date: date
    status: Literal["valid", "superseded", "revoked"]
    # The Certificate ID that replaced this one, when `status` is superseded (Reissue).
    superseded_by: str | None = None
    # Set when `status` is revoked.
    revoked_reason: str | None = None
    revoked_at: datetime | None = None


class MyCertificateOut(BaseModel):
    id: uuid.UUID
    public_id: str
    event_name: str
    club_name: str
    event_date: date
    status: Literal["valid", "superseded", "revoked"]
    issued_at: datetime
    # The Certificate ID that replaced this one, when `status` is superseded.
    superseded_by_public_id: str | None = None
