"""HTTP routes for events, Registration Forms and Eligibility Rules (P2): R7-R11, R15."""

import uuid

from fastapi import APIRouter, Depends, status

from app.core.auth import CurrentStudent, DbSession, OptionalStudent
from app.core.errors import ErrorResponse
from app.core.permissions import require_club_member, require_event_club_member
from app.core.ratelimit import event_page_rate_limit
from app.events import service
from app.events.schemas import (
    EligibilityRulesIn,
    EventCreate,
    EventOut,
    EventPublicOut,
    EventUpdate,
    RegistrationFormIn,
    RegistrationFormOut,
)

router = APIRouter(tags=["events"])

_ERR = {"model": ErrorResponse}
_MEMBER_ERRORS = {401: _ERR, 403: _ERR, 404: _ERR}
_FORM_ERRORS = {400: _ERR, 401: _ERR, 403: _ERR, 404: _ERR, 409: _ERR}


@router.post(
    "/clubs/{club_id}/events",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
    responses=_MEMBER_ERRORS,
)
def create_event(
    club_id: uuid.UUID, body: EventCreate, db: DbSession, student: CurrentStudent
) -> EventOut:
    """Create an Event and its one empty Registration Form. President or Coordinator."""
    require_club_member(db, student, club_id)
    event = service.create_event(db, club_id, student, body)
    db.commit()
    return service.event_out(db, event)


@router.get("/events/{event_id}", response_model=EventOut, responses=_MEMBER_ERRORS)
def get_event(event_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> EventOut:
    require_event_club_member(db, student, event_id)
    return service.event_out(db, service.get_event_or_404(db, event_id))


@router.patch(
    "/events/{event_id}", response_model=EventOut, responses={**_MEMBER_ERRORS, 422: _ERR}
)
def update_event(
    event_id: uuid.UUID, body: EventUpdate, db: DbSession, student: CurrentStudent
) -> EventOut:
    require_event_club_member(db, student, event_id)
    event = service.update_event(db, service.get_event_or_404(db, event_id), body)
    db.commit()
    return service.event_out(db, event)


@router.get("/events/{event_id}/form", response_model=RegistrationFormOut, responses=_MEMBER_ERRORS)
def get_form(event_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> RegistrationFormOut:
    require_event_club_member(db, student, event_id)
    return service.form_out(db, event_id)


@router.put("/events/{event_id}/form", response_model=RegistrationFormOut, responses=_FORM_ERRORS)
def replace_form(
    event_id: uuid.UUID, body: RegistrationFormIn, db: DbSession, student: CurrentStudent
) -> RegistrationFormOut:
    """Replace the custom Form Fields (upserted by `key`). Once answered, a field can't be
    deleted or retyped (hide it instead); once Registrations exist, new fields must be
    optional (409)."""
    require_event_club_member(db, student, event_id)
    out = service.replace_form(db, service.get_event_or_404(db, event_id), body)
    db.commit()
    return out


@router.put(
    "/events/{event_id}/eligibility",
    response_model=EligibilityRulesIn,
    responses={**_MEMBER_ERRORS, 400: _ERR},
)
def replace_eligibility(
    event_id: uuid.UUID, body: EligibilityRulesIn, db: DbSession, student: CurrentStudent
) -> EligibilityRulesIn:
    require_event_club_member(db, student, event_id)
    out = service.replace_eligibility(db, service.get_event_or_404(db, event_id), body)
    db.commit()
    return out


@router.post("/events/{event_id}/close", response_model=EventOut, responses=_MEMBER_ERRORS)
def close_event(event_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> EventOut:
    require_event_club_member(db, student, event_id)
    event = service.set_manually_closed(db, service.get_event_or_404(db, event_id), True)
    db.commit()
    return service.event_out(db, event)


@router.post("/events/{event_id}/reopen", response_model=EventOut, responses=_MEMBER_ERRORS)
def reopen_event(event_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> EventOut:
    require_event_club_member(db, student, event_id)
    event = service.set_manually_closed(db, service.get_event_or_404(db, event_id), False)
    db.commit()
    return service.event_out(db, event)


@router.get(
    "/events/{event_id}/public",
    response_model=EventPublicOut,
    dependencies=[Depends(event_page_rate_limit)],
    responses={404: _ERR, 429: _ERR},
)
def get_event_page(event_id: uuid.UUID, db: DbSession, student: OptionalStudent) -> EventPublicOut:
    """Public: the Event QR lands here. Logged-out visitors see the Event and form; the
    eligibility and registration fields are filled only when a session cookie is sent."""
    return service.public_page(db, service.get_event_or_404(db, event_id), student)
