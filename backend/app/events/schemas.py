"""Request/response models for events, Registration Forms and Eligibility Rules (P2).

Datetimes must be timezone-aware ISO 8601 (decision 32): naive values are rejected with
422. They are stored and returned in UTC.
"""

import uuid
from typing import Literal, Self

from pydantic import AwareDatetime, BaseModel, Field, model_validator

FormFieldType = Literal[
    "short_text",
    "long_text",
    "number",
    "email",
    "phone",
    "date",
    "single_choice",
    "multi_choice",
    "yes_no",
]

OpenReason = Literal["closed_by_club", "deadline_passed", "full"]


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    venue: str = Field(default="", max_length=200)
    approval_required: bool = False
    seat_limit: int | None = Field(default=None, ge=1)
    registration_deadline: AwareDatetime | None = None

    @model_validator(mode="after")
    def _ends_after_start(self) -> Self:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at. Pick a later end time.")
        return self


#: Event columns that can't be cleared, so an explicit null in a patch is rejected.
_NOT_NULLABLE = ("name", "description", "starts_at", "ends_at", "venue", "approval_required")


class EventUpdate(BaseModel):
    """Only the fields sent are changed. Send `seat_limit` or `registration_deadline` as
    null to remove the Seat Limit or Registration Deadline."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    venue: str | None = Field(default=None, max_length=200)
    approval_required: bool | None = None
    seat_limit: int | None = Field(default=None, ge=1)
    registration_deadline: AwareDatetime | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        for name in _NOT_NULLABLE:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} can't be null. Leave it out to keep the current value.")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at. Pick a later end time.")
        return self


class FormField(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=50)
    label: str = Field(max_length=200)
    type: FormFieldType
    required: bool = False
    help_text: str = ""
    options: list[str] = Field(default_factory=list)
    hidden: bool = False


class RegistrationFormIn(BaseModel):
    """Custom Form Fields in display order. Profile fields are added automatically."""

    fields: list[FormField]


class RegistrationFormOut(RegistrationFormIn):
    event_id: uuid.UUID
    profile_fields: list[str]


class EligibilityRule(BaseModel):
    field: Literal["department", "year", "section"]
    operator: Literal["in"] = "in"
    values: list[str] = Field(min_length=1)


class EligibilityRulesIn(BaseModel):
    """All rules are ANDed together."""

    rules: list[EligibilityRule]


class EventOut(EventCreate):
    id: uuid.UUID
    club_id: uuid.UUID
    manually_closed: bool
    is_open: bool
    closed_reason: OpenReason | None = Field(
        default=None, description="Why registration is closed; null while Open."
    )
    confirmed_count: int
    pending_count: int = 0
    eligibility_rules: list[EligibilityRule] = Field(default_factory=list)


class EventPublicOut(BaseModel):
    """The Event page for the calling Student."""

    id: uuid.UUID
    club_id: uuid.UUID
    club_name: str
    name: str
    description: str
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    venue: str
    approval_required: bool
    registration_deadline: AwareDatetime | None
    is_open: bool
    closed_reason: OpenReason | None = Field(
        default=None, description="Why registration is closed; null while Open."
    )
    seats_left: int | None
    form: RegistrationFormIn = Field(description="Visible (non-hidden) Form Fields only.")
    am_i_eligible: bool | None = Field(
        description="Null when the caller isn't logged in (the page is public, decision 29)."
    )
    failed_rules: list[str] | None = Field(
        default=None,
        description="The Eligibility Rules the caller fails, as text. Null when anonymous; "
        "empty when eligible.",
    )
    my_registration_status: Literal["pending", "confirmed", "rejected", "cancelled"] | None
