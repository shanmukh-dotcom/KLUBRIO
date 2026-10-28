"""Events, Registration Forms and Eligibility Rules (P2): R7-R11, R15.

Writes only the events module's tables (events, registration_forms, form_fields,
eligibility_rules). Reads `registrations` for counts, answered keys and the caller's
status, and `clubs` for the Club name.

Read helpers other modules import (keep these names stable): `get_event_or_404`,
`event_open_state`, `confirmed_count`, `form_fields_for`.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import status
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.accounts.models import Club, Student
from app.core.errors import AppError
from app.events import schemas
from app.events.models import (
    EligibilityField,
    EligibilityOperator,
    EligibilityRule,
    Event,
    FormField,
    FormFieldType,
    RegistrationForm,
)
from app.events.rules import PROFILE_FIELDS, FormError, check_eligibility, check_form_edit, is_open
from app.registrations.models import Registration, RegistrationStatus

#: FormError codes that mean "conflicts with existing Registrations" (409); others are 400.
_CONFLICT_CODES = frozenset({"field_locked", "required_field_blocked"})


def _now() -> datetime:
    return datetime.now(UTC)


def _utc(dt: datetime | None) -> datetime | None:
    return dt.astimezone(UTC) if dt is not None else None


# --------------------------------------------------------------------------- read helpers


def get_event_or_404(db: Session, event_id: uuid.UUID) -> Event:
    """The Event, or 404 `event_not_found`."""
    event = db.get(Event, event_id)
    if event is None:
        raise AppError(
            "event_not_found",
            "No Event has this ID. Check the link and try again.",
            status.HTTP_404_NOT_FOUND,
        )
    return event


def _count(db: Session, event_id: uuid.UUID, reg_status: RegistrationStatus) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Registration)
            .where(Registration.event_id == event_id, Registration.status == reg_status)
        )
        or 0
    )


def confirmed_count(db: Session, event_id: uuid.UUID) -> int:
    """How many Confirmed Registrations the Event has (these fill seats)."""
    return _count(db, event_id, RegistrationStatus.CONFIRMED)


def pending_count(db: Session, event_id: uuid.UUID) -> int:
    return _count(db, event_id, RegistrationStatus.PENDING)


def event_open_state(
    db: Session, event: Event, confirmed_count: int | None = None, now: datetime | None = None
) -> tuple[bool, str | None]:
    """`(open, reason)` for the Event (R15). Pass `confirmed_count` when you already hold it
    (e.g. counted under the seat lock) to skip the query. Reason is `closed_by_club`,
    `deadline_passed` or `full`; None while Open."""
    if confirmed_count is None:
        confirmed_count = _count(db, event.id, RegistrationStatus.CONFIRMED)
    return is_open(
        event.manually_closed,
        event.registration_deadline,
        event.seat_limit,
        confirmed_count,
        now or _now(),
    )


def form_for(db: Session, event_id: uuid.UUID) -> RegistrationForm:
    form = db.scalar(select(RegistrationForm).where(RegistrationForm.event_id == event_id))
    if form is None:  # Every Event gets its form on creation; this guards old rows.
        form = RegistrationForm(event_id=event_id)
        db.add(form)
        db.flush()
    return form


def form_fields_for(db: Session, event_id: uuid.UUID) -> list[FormField]:
    """The Event's custom Form Fields (hidden ones included) in display order."""
    return list(
        db.scalars(
            select(FormField)
            .join(RegistrationForm, RegistrationForm.id == FormField.form_id)
            .where(RegistrationForm.event_id == event_id)
            .order_by(FormField.position)
        )
    )


def eligibility_rules_for(db: Session, event_id: uuid.UUID) -> list[EligibilityRule]:
    return list(
        db.scalars(
            select(EligibilityRule)
            .where(EligibilityRule.event_id == event_id)
            .order_by(EligibilityRule.created_at, EligibilityRule.id)
        )
    )


def answered_keys(db: Session, event_id: uuid.UUID) -> set[str]:
    """Form Field keys any Registration of this Event has an answer for."""
    rows = db.execute(
        text("select distinct jsonb_object_keys(answers) from registrations where event_id = :id"),
        {"id": event_id},
    )
    return {row[0] for row in rows}


def has_registrations(db: Session, event_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(select(select(Registration.id).where(Registration.event_id == event_id).exists()))
    )


def student_profile(student: Student) -> dict[str, Any]:
    return {name: getattr(student, name) for name in PROFILE_FIELDS}


# --------------------------------------------------------------------------- serialization


def field_out(field: FormField) -> schemas.FormField:
    return schemas.FormField(
        key=field.key,
        label=field.label,
        type=field.type.value if isinstance(field.type, FormFieldType) else field.type,
        required=field.required,
        help_text=field.help_text or "",
        options=list(field.options or []),
        hidden=field.hidden,
    )


def rule_out(rule: EligibilityRule) -> schemas.EligibilityRule:
    return schemas.EligibilityRule(
        field=str(rule.field), operator=str(rule.operator), values=[str(v) for v in rule.values]
    )


def event_out(db: Session, event: Event) -> schemas.EventOut:
    confirmed = confirmed_count(db, event.id)
    open_, reason = event_open_state(db, event, confirmed)
    return schemas.EventOut(
        id=event.id,
        club_id=event.club_id,
        name=event.name,
        description=event.description or "",
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        venue=event.venue or "",
        approval_required=event.approval_required,
        seat_limit=event.seat_limit,
        registration_deadline=event.registration_deadline,
        manually_closed=event.manually_closed,
        is_open=open_,
        closed_reason=reason,
        confirmed_count=confirmed,
        pending_count=pending_count(db, event.id),
        eligibility_rules=[rule_out(r) for r in eligibility_rules_for(db, event.id)],
    )


def form_out(db: Session, event_id: uuid.UUID) -> schemas.RegistrationFormOut:
    return schemas.RegistrationFormOut(
        event_id=event_id,
        profile_fields=list(PROFILE_FIELDS),
        fields=[field_out(f) for f in form_fields_for(db, event_id)],
    )


# --------------------------------------------------------------------------- writes


def create_event(
    db: Session, club_id: uuid.UUID, created_by: Student, body: schemas.EventCreate
) -> Event:
    """Create the Event and its one empty Registration Form together (decision 5).
    The caller has checked the Club Role and commits."""
    if db.get(Club, club_id) is None:
        raise AppError(
            "club_not_found",
            "No Club has this ID. Check the link and try again.",
            status.HTTP_404_NOT_FOUND,
        )
    event = Event(
        club_id=club_id,
        name=body.name,
        description=body.description,
        starts_at=_utc(body.starts_at),
        ends_at=_utc(body.ends_at),
        venue=body.venue,
        approval_required=body.approval_required,
        seat_limit=body.seat_limit,
        registration_deadline=_utc(body.registration_deadline),
        manually_closed=False,
        created_by=created_by.id,
    )
    db.add(event)
    db.flush()
    db.add(RegistrationForm(event_id=event.id))
    db.flush()
    return event


def update_event(db: Session, event: Event, body: schemas.EventUpdate) -> Event:
    """Apply only the fields that were sent. The caller commits."""
    changes = body.model_dump(exclude_unset=True)
    starts_at = changes.get("starts_at", event.starts_at)
    ends_at = changes.get("ends_at", event.ends_at)
    if ends_at <= starts_at:
        raise AppError(
            "invalid_event_dates",
            "ends_at must be after starts_at. Pick a later end time or an earlier start.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )
    for name, value in changes.items():
        if isinstance(value, datetime):
            value = _utc(value)
        setattr(event, name, value)
    db.flush()
    return event


def set_manually_closed(db: Session, event: Event, closed: bool) -> Event:
    event.manually_closed = closed
    db.flush()
    return event


def _form_error(exc: FormError) -> AppError:
    message = exc.message
    if exc.errors:
        details = "; ".join(f"{key}: {msg}" for key, msg in exc.errors.items())
        message = f"{message} ({details})"
    code = status.HTTP_409_CONFLICT if exc.code in _CONFLICT_CODES else status.HTTP_400_BAD_REQUEST
    return AppError(exc.code, message, code)


def _check_options(fields: list[schemas.FormField]) -> None:
    for field in fields:
        if field.type in ("single_choice", "multi_choice"):
            cleaned = [o.strip() for o in field.options]
            if not cleaned or any(not o for o in cleaned):
                raise AppError(
                    "bad_options",
                    f"Field {field.key!r} is a choice field, so it needs at least one "
                    "non-empty option. Add its options.",
                )
            if len(set(cleaned)) != len(cleaned):
                raise AppError(
                    "bad_options",
                    f"Field {field.key!r} lists an option more than once. Remove the duplicate.",
                )


def replace_form(
    db: Session, event: Event, body: schemas.RegistrationFormIn
) -> schemas.RegistrationFormOut:
    """Replace the custom Form Field list (R9, R10), keeping field ids and keys stable:
    existing keys are updated in place, new keys inserted, removed keys deleted (allowed
    only when nobody answered them). The caller commits."""
    form = form_for(db, event.id)
    existing = form_fields_for(db, event.id)
    new_fields = [
        f.model_copy(update={"options": [o.strip() for o in f.options]})
        if f.type in ("single_choice", "multi_choice")
        else f.model_copy(update={"options": []})
        for f in body.fields
    ]

    try:
        check_form_edit(
            [field_out(f) for f in existing],
            new_fields,
            answered_keys(db, event.id),
            has_registrations(db, event.id),
        )
    except FormError as exc:
        raise _form_error(exc) from None
    _check_options(new_fields)

    by_key = {f.key: f for f in existing}
    keep = {f.key for f in new_fields}
    for f in existing:
        if f.key not in keep:
            db.delete(f)
    db.flush()

    for position, data in enumerate(new_fields):
        row = by_key.get(data.key)
        if row is None:
            row = FormField(form_id=form.id, key=data.key)
            db.add(row)
        row.label = data.label
        row.type = FormFieldType(data.type)
        row.required = data.required
        row.help_text = data.help_text
        row.options = list(data.options)
        row.position = position
        row.hidden = data.hidden
    db.flush()
    return form_out(db, event.id)


def replace_eligibility(
    db: Session, event: Event, body: schemas.EligibilityRulesIn
) -> schemas.EligibilityRulesIn:
    """Replace all Eligibility Rules. They test Student Profile fields only (rule 5).
    The caller commits."""
    rules: list[schemas.EligibilityRule] = []
    for rule in body.rules:
        values = [v.strip() for v in rule.values]
        if any(not v for v in values):
            raise AppError(
                "bad_rule",
                f"An Eligibility Rule on {rule.field!r} has an empty value. Remove it.",
            )
        if rule.field == "year" and any(not v.isdigit() for v in values):
            raise AppError(
                "bad_rule",
                "Year rules take whole numbers (e.g. 1, 2, 3). Fix the year values.",
            )
        rules.append(rule.model_copy(update={"values": values}))

    db.execute(delete(EligibilityRule).where(EligibilityRule.event_id == event.id))
    for rule in rules:
        db.add(
            EligibilityRule(
                event_id=event.id,
                field=EligibilityField(rule.field),
                operator=EligibilityOperator(rule.operator),
                values=list(rule.values),
            )
        )
    db.flush()
    return schemas.EligibilityRulesIn(rules=rules)


# --------------------------------------------------------------------------- public page


def public_page(db: Session, event: Event, student: Student | None) -> schemas.EventPublicOut:
    """The public Event page (decision 29). Never exposes `created_by` or other Students'
    data; eligibility and registration status are null for anonymous visitors."""
    club = db.get(Club, event.club_id)
    confirmed = confirmed_count(db, event.id)
    open_, reason = event_open_state(db, event, confirmed)
    seats_left = None if event.seat_limit is None else max(event.seat_limit - confirmed, 0)
    visible = [field_out(f) for f in form_fields_for(db, event.id) if not f.hidden]

    am_i_eligible: bool | None = None
    failed: list[str] | None = None
    my_status: str | None = None
    if student is not None:
        failed = check_eligibility(student_profile(student), eligibility_rules_for(db, event.id))
        am_i_eligible = not failed
        reg_status = db.scalar(
            select(Registration.status).where(
                Registration.event_id == event.id, Registration.student_id == student.id
            )
        )
        my_status = str(reg_status) if reg_status is not None else None

    return schemas.EventPublicOut(
        id=event.id,
        club_id=event.club_id,
        club_name=club.name if club else "",
        name=event.name,
        description=event.description or "",
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        venue=event.venue or "",
        approval_required=event.approval_required,
        registration_deadline=event.registration_deadline,
        is_open=open_,
        closed_reason=reason,
        seats_left=seats_left,
        form=schemas.RegistrationFormIn(fields=visible),
        am_i_eligible=am_i_eligible,
        failed_rules=failed,
        my_registration_status=my_status,
    )
