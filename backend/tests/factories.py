"""Helpers that create rows for DB-backed tests. Use with the `db` fixture in conftest.py."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.accounts.models import Club, ClubRole, ClubRoleKind, Student, University
from app.core.auth import create_session
from app.core.security import hash_password
from app.events.models import Event, RegistrationForm

PASSWORD = "correct horse battery"


def make_student(db: Session, **overrides) -> Student:
    n = uuid.uuid4().hex[:8]
    values = dict(
        email=f"s{n}@example.com",
        password_hash=hash_password(PASSWORD),
        name=f"Student {n}",
        roll_no=f"R{n}",
        department="CSE",
        year=3,
        section="A",
    )
    values.update(overrides)
    student = Student(**values)
    db.add(student)
    db.flush()
    return student


def make_club(db: Session, president: Student | None = None) -> Club:
    university = University(name="Test University")
    db.add(university)
    db.flush()
    club = Club(university_id=university.id, name="Test Club", slug=f"club-{uuid.uuid4().hex[:8]}")
    db.add(club)
    db.flush()
    if president is not None:
        db.add(ClubRole(club_id=club.id, student_id=president.id, role=ClubRoleKind.PRESIDENT))
        db.flush()
    return club


def add_coordinator(db: Session, club: Club, student: Student) -> None:
    db.add(ClubRole(club_id=club.id, student_id=student.id, role=ClubRoleKind.COORDINATOR))
    db.flush()


def make_event(db: Session, club: Club, created_by: Student, **overrides) -> Event:
    now = datetime.now(UTC)
    values = dict(
        club_id=club.id,
        name="Test Event",
        starts_at=now + timedelta(days=7),
        ends_at=now + timedelta(days=7, hours=3),
        created_by=created_by.id,
    )
    values.update(overrides)
    event = Event(**values)
    db.add(event)
    db.flush()
    db.add(RegistrationForm(event_id=event.id))
    db.flush()
    return event


def login(client, db: Session, student: Student) -> None:
    """Give the test client a valid session cookie for `student`."""
    from app.core.settings import get_settings

    token = create_session(db, student)
    db.flush()
    client.cookies.set(get_settings().session_cookie_name, token)
