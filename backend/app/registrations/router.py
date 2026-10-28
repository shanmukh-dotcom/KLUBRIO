"""HTTP routes for Registrations (P2): R12-R18. Logic lives in `service.py`."""

import uuid

from fastapi import APIRouter, Query, status

from app.core.auth import CurrentStudent, DbSession
from app.core.errors import ErrorResponse
from app.core.permissions import require_event_club_member
from app.registrations import service
from app.registrations.models import Registration
from app.registrations.models import RegistrationStatus as StatusEnum
from app.registrations.schemas import RegistrationIn, RegistrationOut, RegistrationStatus

router = APIRouter(tags=["registrations"])


def _err(description: str) -> dict:
    return {"model": ErrorResponse, "description": description}


def to_out(reg: Registration) -> RegistrationOut:
    return RegistrationOut(
        id=reg.id,
        event_id=reg.event_id,
        student_id=reg.student_id,
        profile_snapshot=reg.profile_snapshot,
        answers=reg.answers,
        status=StatusEnum(reg.status).value,
        submitted_at=reg.submitted_at,
        decided_at=reg.decided_at,
        decided_by=reg.decided_by,
    )


@router.post(
    "/events/{event_id}/registrations",
    response_model=RegistrationOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: _err("Not logged in."),
        403: _err("`not_eligible`: the Student Profile fails the Eligibility Rules."),
        404: _err("`event_not_found`."),
        409: _err(
            "`registration_closed` (closed by the Club, deadline passed or full), "
            "`already_registered`, or `registration_rejected`."
        ),
        422: _err("`invalid_answers`: per-field problems are listed in the message."),
    },
)
def register(
    event_id: uuid.UUID, body: RegistrationIn, db: DbSession, student: CurrentStudent
) -> RegistrationOut:
    reg = service.register(db, event_id, student, body.answers)
    db.commit()
    return to_out(reg)


@router.delete(
    "/events/{event_id}/registrations/me",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: _err("Not logged in."),
        404: _err("`event_not_found`, or `registration_not_found` (nothing active to cancel)."),
        409: _err("`registration_closed`: cancelling is only allowed while Open."),
    },
)
def cancel_my_registration(event_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> None:
    service.cancel(db, event_id, student)
    db.commit()


@router.get(
    "/events/{event_id}/registrations",
    response_model=list[RegistrationOut],
    responses={
        401: _err("Not logged in."),
        403: _err("Not the President or a Coordinator of the Event's Club."),
        404: _err("`event_not_found`."),
    },
)
def list_registrations(
    event_id: uuid.UUID,
    db: DbSession,
    student: CurrentStudent,
    status: RegistrationStatus | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[RegistrationOut]:
    require_event_club_member(db, student, event_id)
    status_filter = StatusEnum(status) if status is not None else None
    regs = service.list_registrations(db, event_id, status_filter, limit, offset)
    return [to_out(r) for r in regs]


_DECISION_RESPONSES = {
    401: _err("Not logged in."),
    403: _err("Not the President or a Coordinator of the Event's Club."),
    404: _err("`registration_not_found`."),
    409: _err("`invalid_transition` (not Pending), or `event_full` (approve only)."),
}


@router.post(
    "/registrations/{registration_id}/approve",
    response_model=RegistrationOut,
    responses=_DECISION_RESPONSES,
)
def approve(registration_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> RegistrationOut:
    reg = service.get_registration(db, registration_id)
    require_event_club_member(db, student, reg.event_id)
    reg = service.approve(db, registration_id, student)
    db.commit()
    return to_out(reg)


@router.post(
    "/registrations/{registration_id}/reject",
    response_model=RegistrationOut,
    responses=_DECISION_RESPONSES,
)
def reject(registration_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> RegistrationOut:
    reg = service.get_registration(db, registration_id)
    require_event_club_member(db, student, reg.event_id)
    reg = service.reject(db, registration_id, student)
    db.commit()
    return to_out(reg)
