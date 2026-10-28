"""Create the first Platform Admin, or promote an existing account.

There is no API for this: the first Platform Admin has to come from the server side.

    uv run python scripts/create_admin.py --email admin@uni.edu --name "Admin" --password "..."

Running it again is safe. An existing account (matched by email) is promoted, and its
password is reset to the one given. It reads `ORGNISER_DATABASE_URL` like the app does.
"""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.accounts.models import Student, StudentStatus  # noqa: E402
from app.core.db import get_engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402


@dataclass(frozen=True)
class AdminResult:
    student_id: str
    email: str
    action: str  # "created", "promoted" or "unchanged"


def create_admin(
    *,
    email: str,
    name: str,
    password: str,
    roll_no: str = "ADMIN",
    department: str = "Administration",
    year: int = 1,
    section: str = "A",
) -> AdminResult:
    """Create or promote the Platform Admin. Idempotent; returns what it did."""
    if len(password) < 8:
        raise ValueError("The password must be at least 8 characters.")
    email = email.strip().lower()
    session = sessionmaker(bind=get_engine(), expire_on_commit=False)()
    try:
        student = session.scalar(select(Student).where(Student.email == email))
        if student is None:
            student = Student(
                email=email,
                password_hash=hash_password(password),
                name=name,
                roll_no=roll_no,
                department=department,
                year=year,
                section=section,
                is_platform_admin=True,
                status=StudentStatus.ACTIVE,
            )
            session.add(student)
            action = "created"
        else:
            action = "unchanged" if student.is_platform_admin else "promoted"
            student.is_platform_admin = True
            student.password_hash = hash_password(password)
            if student.status != StudentStatus.ACTIVE:
                student.status = StudentStatus.ACTIVE
                student.removed_at = None
                action = "promoted"
        session.commit()
        return AdminResult(str(student.id), student.email, action)
    finally:
        session.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create or promote the Platform Admin.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--roll-no", default="ADMIN")
    parser.add_argument("--department", default="Administration")
    parser.add_argument("--year", type=int, default=1)
    parser.add_argument("--section", default="A")
    args = parser.parse_args(argv)

    try:
        result = create_admin(
            email=args.email,
            name=args.name,
            password=args.password,
            roll_no=args.roll_no,
            department=args.department,
            year=args.year,
            section=args.section,
        )
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    if result.action == "created":
        print(f"Created Platform Admin {result.email} (id {result.student_id}).")
    elif result.action == "promoted":
        print(f"Promoted {result.email} (id {result.student_id}) to Platform Admin.")
    else:
        print(
            f"{result.email} (id {result.student_id}) is already the Platform Admin; "
            "password updated."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
