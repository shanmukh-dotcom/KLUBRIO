"""Club Role checks (R6; RULES.md, engineering rule 7).

Every club-scoped endpoint calls one of these. A Club Role grants nothing outside its own
Club. The Platform Admin passes every check.
"""

import uuid

from fastapi import status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.accounts.models import ClubRole, ClubRoleKind, Student
from app.core.errors import AppError


def club_role(db: Session, student_id: uuid.UUID, club_id: uuid.UUID) -> ClubRoleKind | None:
    """The Student's Club Role in this Club, or None if they hold none."""
    return db.scalar(
        select(ClubRole.role).where(ClubRole.student_id == student_id, ClubRole.club_id == club_id)
    )


def require_club_member(db: Session, student: Student, club_id: uuid.UUID) -> None:
    """Pass if the Student is the President or a Coordinator of this Club (or Platform Admin)."""
    if student.is_platform_admin:
        return
    if club_role(db, student.id, club_id) is None:
        raise AppError(
            "forbidden",
            "You need to be the President or a Coordinator of this Club to do this.",
            status.HTTP_403_FORBIDDEN,
        )


def require_president(db: Session, student: Student, club_id: uuid.UUID) -> None:
    """Pass if the Student is the President of this Club (or Platform Admin)."""
    if student.is_platform_admin:
        return
    if club_role(db, student.id, club_id) != ClubRoleKind.PRESIDENT:
        raise AppError(
            "forbidden",
            "You need to be the President of this Club to do this.",
            status.HTTP_403_FORBIDDEN,
        )


def _event_club_id(db: Session, event_id: uuid.UUID) -> uuid.UUID:
    # Raw SQL so this module doesn't import the events models.
    club_id = db.execute(
        text("select club_id from events where id = :id"), {"id": event_id}
    ).scalar_one_or_none()
    if club_id is None:
        raise AppError(
            "event_not_found",
            "No Event has this ID. Check the link and try again.",
            status.HTTP_404_NOT_FOUND,
        )
    return club_id


def require_event_club_member(db: Session, student: Student, event_id: uuid.UUID) -> uuid.UUID:
    """Pass if the Student is the President or a Coordinator of the Event's Club (or
    Platform Admin). Returns the Event's `club_id`; 404 `event_not_found` if no Event."""
    club_id = _event_club_id(db, event_id)
    require_club_member(db, student, club_id)
    return club_id


def require_event_president(db: Session, student: Student, event_id: uuid.UUID) -> uuid.UUID:
    """Pass if the Student is the President of the Event's Club (or Platform Admin).
    Returns the Event's `club_id`; 404 `event_not_found` if no Event."""
    club_id = _event_club_id(db, event_id)
    require_president(db, student, club_id)
    return club_id
