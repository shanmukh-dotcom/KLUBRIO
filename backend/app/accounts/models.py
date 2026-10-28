"""Tables owned by accounts (P6): universities, clubs, students, club_roles, sessions,
password_reset_tokens."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class ClubRoleKind(enum.StrEnum):
    PRESIDENT = "president"
    COORDINATOR = "coordinator"


class StudentStatus(enum.StrEnum):
    ACTIVE = "active"
    # Removed by the Platform Admin. The row stays so Registrations and Certificates keep
    # their owner (ADR 0001); a removed Student can't log in and holds no Club Roles.
    REMOVED = "removed"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class University(TimestampedBase):
    __tablename__ = "universities"

    name: Mapped[str] = mapped_column(String(200))
    # Dates and the Registration Deadline are entered and shown in this zone; stored in UTC.
    timezone: Mapped[str] = mapped_column(String(64), server_default="Asia/Kolkata")


class Club(TimestampedBase):
    __tablename__ = "clubs"

    university_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("universities.id"))
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True)


class Student(TimestampedBase):
    """A Student account and its Student Profile."""

    __tablename__ = "students"

    email: Mapped[str] = mapped_column(String(320), unique=True)
    # Password login (decision 24). Null only for an account the Platform Admin created
    # that hasn't set a password yet; it sets one through the password-reset flow.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(200))
    # Not unique in v1: the account is the identity (decision 4b).
    roll_no: Mapped[str] = mapped_column(String(50), index=True)
    department: Mapped[str] = mapped_column(String(100))
    year: Mapped[int]
    section: Mapped[str] = mapped_column(String(20))
    is_platform_admin: Mapped[bool] = mapped_column(server_default=text("false"))
    status: Mapped[StudentStatus] = mapped_column(
        _enum(StudentStatus, "student_status"), server_default=StudentStatus.ACTIVE.value
    )
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginSession(TimestampedBase):
    """A login session behind the HTTP-only cookie (decision 25). Only a hash of the
    cookie value is stored, so a database leak doesn't hand out live sessions."""

    __tablename__ = "sessions"

    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PasswordResetToken(TimestampedBase):
    """One-time, short-lived token emailed for "forgot password" and for first-time
    password setup on admin-created accounts. Stored hashed, like sessions."""

    __tablename__ = "password_reset_tokens"

    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ClubRole(TimestampedBase):
    __tablename__ = "club_roles"
    __table_args__ = (
        UniqueConstraint("club_id", "student_id"),
        # One President per Club.
        Index(
            "uq_club_roles_one_president",
            "club_id",
            unique=True,
            postgresql_where=text("role = 'president'"),
        ),
    )

    club_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id", ondelete="CASCADE"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    role: Mapped[ClubRoleKind] = mapped_column(_enum(ClubRoleKind, "club_role_kind"))
