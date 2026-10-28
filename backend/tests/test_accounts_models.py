import pytest
from sqlalchemy.exc import IntegrityError

from app.accounts.models import Club, ClubRole, ClubRoleKind, Student, University


def _student(session, email: str) -> Student:
    student = Student(
        email=email, name="Test", roll_no="21CS001", department="CSE", year=3, section="A"
    )
    session.add(student)
    return student


def _club(session) -> Club:
    university = University(name="Test University")
    session.add(university)
    session.flush()
    club = Club(university_id=university.id, name="Robotics", slug="robotics")
    session.add(club)
    session.flush()
    return club


def test_roll_no_is_not_unique(db):
    _student(db, "a@example.com")
    _student(db, "b@example.com")
    db.flush()  # two Students with the same roll number is allowed (decision 4b)


def test_one_president_per_club(db):
    club = _club(db)
    first, second = _student(db, "p1@example.com"), _student(db, "p2@example.com")
    db.flush()
    db.add(ClubRole(club_id=club.id, student_id=first.id, role=ClubRoleKind.PRESIDENT))
    db.flush()
    db.add(ClubRole(club_id=club.id, student_id=second.id, role=ClubRoleKind.PRESIDENT))
    with pytest.raises(IntegrityError):
        db.flush()


def test_many_coordinators_per_club(db):
    club = _club(db)
    students = [_student(db, f"c{i}@example.com") for i in range(3)]
    db.flush()
    for student in students:
        db.add(ClubRole(club_id=club.id, student_id=student.id, role=ClubRoleKind.COORDINATOR))
    db.flush()
