"""Registrations (P2): register, cancel, list, approve, reject (R12-R18).

Seat counting follows engineering rule 2: every path that can add a Confirmed
Registration first locks the Event row (`SELECT ... FOR UPDATE`) and only then counts
Confirmed Registrations, in the same transaction. Concurrent submits for one Event
therefore queue on that lock and each sees the count the previous one committed.

Lock order is always Event row, then Registration row, so the paths can't deadlock.

Functions here flush but never commit; the caller (router, test or job) commits.
"""

import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.core.errors import AppError
from app.events.models import EligibilityRule, Event, FormField, RegistrationForm
from app.events.rules import FormError, check_eligibility, is_open, profile_snapshot
from app.events.rules import validate_answers as _validate_answers
from app.registrations.models import Registration, RegistrationStatus

S = RegistrationStatus

#: DESIGN.md section 5. `from -> allowed targets`. Rejected is final.
TRANSITIONS: dict[RegistrationStatus, frozenset[RegistrationStatus]] = {
    S.PENDING: frozenset({S.CONFIRMED, S.REJECTED, S.CANCELLED}),
    S.CONFIRMED: frozenset({S.CANCELLED}),
    S.CANCELLED: frozenset({S.PENDING, S.CONFIRMED}),
    S.REJECTED: frozenset(),
}

#: Transitions a Student makes, allowed only while the Event is Open.
STUDENT_TRANSITIONS: frozenset[tuple[RegistrationStatus, RegistrationStatus]] = frozenset(
    {
        (S.PENDING, S.CANCELLED),
        (S.CONFIRMED, S.CANCELLED),
        (S.CANCELLED, S.PENDING),
        (S.CANCELLED, S.CONFIRMED),
    }
)

#: Transitions a Club member makes through Approval.
CLUB_TRANSITIONS: frozenset[tuple[RegistrationStatus, RegistrationStatus]] = frozenset(
    {(S.PENDING, S.CONFIRMED), (S.PENDING, S.REJECTED)}
)

ACTIVE_STATUSES: frozenset[RegistrationStatus] = frozenset({S.PENDING, S.CONFIRMED})

CLOSED_REASONS = {
    "closed_by_club": "the Club has closed registration",
    "deadline_passed": "the Registration Deadline has passed",
    "full": "every seat is taken",
}


def can_transition(old: RegistrationStatus, new: RegistrationStatus) -> bool:
    return new in TRANSITIONS[old]


def initial_status(approval_required: bool) -> RegistrationStatus:
    """A new (or re-made) Registration's status: Pending with Approval, else Confirmed."""
    return S.PENDING if approval_required else S.CONFIRMED


class RegistrationError(AppError):
    """An `AppError` that also carries machine-readable detail for callers and tests:
    `reason` (registration_closed), `failed_rules` (not_eligible), `errors` (invalid_answers).
    The HTTP body is still `{"error": {"code", "message"}}`; the detail is in the message."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int,
        *,
        reason: str | None = None,
        failed_rules: Sequence[str] = (),
        errors: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(code, message, status_code)
        self.reason = reason
        self.failed_rules = list(failed_rules)
        self.errors = dict(errors or {})


# --------------------------------------------------------------------------- reads


def _now() -> datetime:
    return datetime.now(UTC)


def _event_not_found() -> AppError:
    return AppError(
        "event_not_found",
        "No Event has this ID. Check the link and try again.",
        status.HTTP_404_NOT_FOUND,
    )


def _registration_not_found() -> AppError:
    return AppError(
        "registration_not_found",
        "No Registration has this ID. Check the link and try again.",
        status.HTTP_404_NOT_FOUND,
    )


def lock_event(db: Session, event_id: uuid.UUID) -> Event:
    """Lock the Event row until the transaction ends and return it freshly read."""
    event = db.scalar(
        select(Event)
        .where(Event.id == event_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if event is None:
        raise _event_not_found()
    return event


def confirmed_count(db: Session, event_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Registration)
        .where(Registration.event_id == event_id, Registration.status == S.CONFIRMED)
    )


def _form_fields(db: Session, event_id: uuid.UUID) -> list[FormField]:
    return list(
        db.scalars(
            select(FormField)
            .join(RegistrationForm, RegistrationForm.id == FormField.form_id)
            .where(RegistrationForm.event_id == event_id)
            .order_by(FormField.position)
        )
    )


def _eligibility_rules(db: Session, event_id: uuid.UUID) -> list[EligibilityRule]:
    return list(db.scalars(select(EligibilityRule).where(EligibilityRule.event_id == event_id)))


def my_registration(db: Session, event_id: uuid.UUID, student_id: uuid.UUID) -> Registration | None:
    """The Student's Registration for this Event in any status, or None. For other modules."""
    return db.scalar(
        select(Registration).where(
            Registration.event_id == event_id, Registration.student_id == student_id
        )
    )


def _lock_my_registration(
    db: Session, event_id: uuid.UUID, student_id: uuid.UUID
) -> Registration | None:
    return db.scalar(
        select(Registration)
        .where(Registration.event_id == event_id, Registration.student_id == student_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def _lock_registration(db: Session, registration_id: uuid.UUID) -> Registration:
    reg = db.scalar(
        select(Registration)
        .where(Registration.id == registration_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if reg is None:
        raise _registration_not_found()
    return reg


def get_registration(db: Session, registration_id: uuid.UUID) -> Registration:
    reg = db.get(Registration, registration_id)
    if reg is None:
        raise _registration_not_found()
    return reg


def list_registrations(
    db: Session,
    event_id: uuid.UUID,
    status_filter: RegistrationStatus | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Registration]:
    query = select(Registration).where(Registration.event_id == event_id)
    if status_filter is not None:
        query = query.where(Registration.status == status_filter)
    query = query.order_by(Registration.submitted_at, Registration.id).limit(limit).offset(offset)
    return list(db.scalars(query))


# --------------------------------------------------------------------------- checks


def _closed_error(reason: str) -> RegistrationError:
    return RegistrationError(
        "registration_closed",
        f"Registration for this Event is closed: {CLOSED_REASONS.get(reason, reason)}.",
        status.HTTP_409_CONFLICT,
        reason=reason,
    )


def _check_open(db: Session, event: Event, *, ignore_full: bool = False) -> None:
    """Raise 409 `registration_closed` unless the Event is Open. Call with the Event locked."""
    is_now_open, reason = is_open(
        manually_closed=event.manually_closed,
        registration_deadline=event.registration_deadline,
        seat_limit=None if ignore_full else event.seat_limit,
        confirmed_count=0 if ignore_full else confirmed_count(db, event.id),
        now=_now(),
    )
    if not is_now_open:
        raise _closed_error(reason or "closed_by_club")


def _check_eligible(db: Session, event: Event, student: Student) -> None:
    profile = {
        "department": student.department,
        "year": student.year,
        "section": student.section,
    }
    failed = check_eligibility(profile, _eligibility_rules(db, event.id))
    if failed:
        raise RegistrationError(
            "not_eligible",
            "Your Student Profile doesn't meet this Event's Eligibility Rules: "
            + "; ".join(failed)
            + ". If your profile is wrong, update it and try again.",
            status.HTTP_403_FORBIDDEN,
            failed_rules=failed,
        )


def _clean_answers(db: Session, event: Event, answers: Mapping[str, Any]) -> dict[str, Any]:
    try:
        return _validate_answers(_form_fields(db, event.id), answers)
    except FormError as exc:
        detail = "; ".join(f"{key}: {msg}" for key, msg in sorted(exc.errors.items()))
        raise RegistrationError(
            "invalid_answers",
            f"Some answers are invalid. Fix them and submit again. {detail}".strip(),
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            errors=exc.errors,
        ) from None


def _invalid_transition(old: RegistrationStatus, action: str) -> AppError:
    return AppError(
        "invalid_transition",
        f"This Registration is {old.value}, so it can't be {action}. "
        "Only Pending Registrations can be approved or rejected.",
        status.HTTP_409_CONFLICT,
    )


# --------------------------------------------------------------------------- writes


def register(
    db: Session, event_id: uuid.UUID, student: Student, answers: Mapping[str, Any]
) -> Registration:
    """Register `student` for the Event (R12-R16; decision 27). The caller commits.

    Order: lock Event -> existing row -> eligibility -> Open (counted under the lock)
    -> answers. A cancelled row is reused; a rejected one can't re-apply.
    """
    event = lock_event(db, event_id)

    existing = _lock_my_registration(db, event_id, student.id)
    if existing is not None and existing.status in ACTIVE_STATUSES:
        raise AppError(
            "already_registered",
            "You've already registered for this Event. Cancel it first if you want to "
            "submit again.",
            status.HTTP_409_CONFLICT,
        )
    if existing is not None and existing.status == S.REJECTED:
        raise AppError(
            "registration_rejected",
            "Your Registration for this Event was rejected, so you can't register again. "
            "Contact the Club if you think this is a mistake.",
            status.HTTP_409_CONFLICT,
        )

    _check_eligible(db, event, student)
    _check_open(db, event)
    cleaned = _clean_answers(db, event, answers)

    new_status = initial_status(event.approval_required)
    now = _now()
    snapshot = profile_snapshot(student, now=now)

    if existing is not None:
        # Decision 27: reuse the cancelled row so (event_id, student_id) stays unique.
        assert can_transition(existing.status, new_status)
        existing.status = new_status
        existing.profile_snapshot = snapshot
        existing.answers = cleaned
        existing.submitted_at = now
        existing.decided_at = None
        existing.decided_by = None
        db.flush()
        return existing

    reg = Registration(
        event_id=event.id,
        student_id=student.id,
        profile_snapshot=snapshot,
        answers=cleaned,
        status=new_status,
        submitted_at=now,
    )
    try:
        with db.begin_nested():
            db.add(reg)
            db.flush()
    except IntegrityError:
        # Backstop: unique (event_id, student_id). The Event lock should make this unreachable.
        raise AppError(
            "already_registered",
            "You've already registered for this Event.",
            status.HTTP_409_CONFLICT,
        ) from None
    return reg


def cancel(db: Session, event_id: uuid.UUID, student: Student) -> Registration:
    """Cancel the Student's own Registration while the Event is Open (R17). Frees the seat.

    "Open" here ignores the Seat Limit: a full Event must still let people cancel, or
    the seat could never be freed. A Club close or a passed deadline does block it.
    """
    event = lock_event(db, event_id)
    reg = _lock_my_registration(db, event_id, student.id)
    if reg is None or reg.status not in ACTIVE_STATUSES:
        raise AppError(
            "registration_not_found",
            "You have no active Registration for this Event, so there's nothing to cancel.",
            status.HTTP_404_NOT_FOUND,
        )
    _check_open(db, event, ignore_full=True)
    reg.status = S.CANCELLED
    db.flush()
    return reg


def approve(db: Session, registration_id: uuid.UUID, decided_by: Student) -> Registration:
    """Approve a Pending Registration (R13), checking the Seat Limit under the Event lock.
    Permission checks are the caller's job."""
    event_id = get_registration(db, registration_id).event_id
    event = lock_event(db, event_id)
    reg = _lock_registration(db, registration_id)
    if (reg.status, S.CONFIRMED) not in CLUB_TRANSITIONS:
        raise _invalid_transition(reg.status, "approved")
    if event.seat_limit is not None and confirmed_count(db, event.id) >= event.seat_limit:
        raise AppError(
            "event_full",
            f"Every seat is taken ({event.seat_limit} of {event.seat_limit}). Raise the Seat "
            "Limit or reject this Registration.",
            status.HTTP_409_CONFLICT,
        )
    reg.status = S.CONFIRMED
    reg.decided_at = _now()
    reg.decided_by = decided_by.id
    db.flush()
    return reg


def reject(db: Session, registration_id: uuid.UUID, decided_by: Student) -> Registration:
    """Reject a Pending Registration (R13). Permission checks are the caller's job."""
    reg = _lock_registration(db, registration_id)
    if (reg.status, S.REJECTED) not in CLUB_TRANSITIONS:
        raise _invalid_transition(reg.status, "rejected")
    reg.status = S.REJECTED
    reg.decided_at = _now()
    reg.decided_by = decided_by.id
    db.flush()
    return reg
