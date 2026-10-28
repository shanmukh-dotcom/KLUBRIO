from datetime import UTC, datetime

from app.accounts.models import Student, StudentStatus, University


def test_new_student_is_active(db):
    student = Student(
        email="s@example.com", name="S", roll_no="1", department="CSE", year=1, section="A"
    )
    db.add(student)
    db.flush()
    db.refresh(student)
    assert student.status == StudentStatus.ACTIVE
    assert student.removed_at is None


def test_removed_student_row_is_kept(db):
    student = Student(
        email="r@example.com", name="R", roll_no="2", department="CSE", year=1, section="A"
    )
    db.add(student)
    db.flush()
    student.status = StudentStatus.REMOVED
    student.removed_at = datetime.now(UTC)
    db.flush()
    assert db.get(Student, student.id).status == StudentStatus.REMOVED


def test_university_timezone_defaults_to_ist(db):
    university = University(name="U")
    db.add(university)
    db.flush()
    db.refresh(university)
    assert university.timezone == "Asia/Kolkata"
