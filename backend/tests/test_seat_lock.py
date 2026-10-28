"""R16 / engineering rule 2: 41 simultaneous submits for 40 seats confirm exactly 40.

Every thread needs its own connection, so this can't use the rolled-back `db` fixture.
Setup is committed, then removed again in `finally` (deleted in FK order).
"""

import threading
import uuid

import pytest
from sqlalchemy import create_engine, delete, func, select
from sqlalchemy.orm import Session

from app.accounts.models import Club, ClubRole, LoginSession, Student, University
from app.core.settings import get_settings
from app.events.models import Event, RegistrationForm
from app.registrations import service
from app.registrations.models import Registration, RegistrationStatus
from app.registrations.service import RegistrationError
from tests.conftest import _probe_db
from tests.factories import make_club, make_event, make_student

SEATS = 40
SUBMITS = 41


def test_41_simultaneous_submits_for_40_seats_confirm_exactly_40():
    if reason := _probe_db():
        pytest.skip(f"PostgreSQL with migrations applied is not available: {reason}")

    # Its own engine: all 41 threads hold a connection at the barrier at once, more than the
    # app's default pool (5 + 10 overflow) allows.
    engine = create_engine(get_settings().database_url, pool_size=SUBMITS + 2, max_overflow=0)
    event_id = club_id = university_id = None
    student_ids: list[uuid.UUID] = []
    try:
        with Session(engine) as setup:
            president = make_student(setup)
            student_ids.append(president.id)
            club = make_club(setup, president=president)
            club_id, university_id = club.id, club.university_id
            event = make_event(setup, club, president, seat_limit=SEATS)
            event_id = event.id
            submitters = [make_student(setup) for _ in range(SUBMITS)]
            submitter_ids = [s.id for s in submitters]
            student_ids.extend(submitter_ids)
            setup.commit()

        barrier = threading.Barrier(SUBMITS)
        outcomes: list[str] = []
        failures: list[BaseException] = []
        guard = threading.Lock()

        def submit(student_id: uuid.UUID) -> None:
            try:
                with Session(engine) as db:
                    student = db.get(Student, student_id)
                    barrier.wait(timeout=60)
                    try:
                        reg = service.register(db, event_id, student, {})
                        db.commit()
                        result = RegistrationStatus(reg.status).value
                    except RegistrationError as exc:
                        db.rollback()
                        result = f"{exc.code}:{exc.reason}"
                with guard:
                    outcomes.append(result)
            except BaseException as exc:  # surfaced by the assert below
                with guard:
                    failures.append(exc)

        threads = [threading.Thread(target=submit, args=(sid,)) for sid in submitter_ids]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=120)

        assert not failures, failures
        assert sorted(outcomes) == sorted(
            ["confirmed"] * SEATS + ["registration_closed:full"] * (SUBMITS - SEATS)
        )
        with Session(engine) as check:
            confirmed = check.scalar(
                select(func.count())
                .select_from(Registration)
                .where(
                    Registration.event_id == event_id,
                    Registration.status == RegistrationStatus.CONFIRMED,
                )
            )
        assert confirmed == SEATS
    finally:
        with Session(engine) as cleanup:
            if event_id is not None:
                cleanup.execute(delete(Registration).where(Registration.event_id == event_id))
                cleanup.execute(
                    delete(RegistrationForm).where(RegistrationForm.event_id == event_id)
                )
                cleanup.execute(delete(Event).where(Event.id == event_id))
            if club_id is not None:
                cleanup.execute(delete(ClubRole).where(ClubRole.club_id == club_id))
                cleanup.execute(delete(Club).where(Club.id == club_id))
            if university_id is not None:
                cleanup.execute(delete(University).where(University.id == university_id))
            if student_ids:
                cleanup.execute(
                    delete(LoginSession).where(LoginSession.student_id.in_(student_ids))
                )
                cleanup.execute(delete(Student).where(Student.id.in_(student_ids)))
            cleanup.commit()
        engine.dispose()
