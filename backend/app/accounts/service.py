"""Business logic for accounts (P6): signup and login, password reset, the Student
Profile, Platform Admin account management, Clubs and Club Roles (R1-R6; decisions 24,
25, 28, 31).

This module writes only P6's tables: universities, clubs, students, club_roles, sessions
and password_reset_tokens. Functions flush but never commit; the router commits.

Emails (reset and set-password links) are built here and sent by the router *after* the
commit, so a link is never mailed for a token that didn't get saved.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from functools import lru_cache

from fastapi import status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import (
    Club,
    ClubRole,
    ClubRoleKind,
    LoginSession,
    PasswordResetToken,
    Student,
    StudentStatus,
    University,
)
from app.accounts.schemas import (
    AdminStudentCreate,
    ClubCreate,
    ClubRoleOut,
    SignupRequest,
    StudentProfileUpdate,
)
from app.core.auth import create_session, revoke_all_sessions
from app.core.email import EmailMessage, get_email_sender
from app.core.errors import AppError
from app.core.security import hash_password, hash_token, needs_rehash, new_token, verify_password
from app.core.settings import get_settings

logger = logging.getLogger(__name__)

# Admin-created accounts get longer to set their first password than a "forgot password"
# link gives (which uses `password_reset_ttl_minutes`).
SET_PASSWORD_TTL = timedelta(days=7)

# Name of the University row created when the first Club is made and none exists yet.
# v1 serves one university (PRD); the Platform Admin can rename the row later.
DEFAULT_UNIVERSITY_NAME = "University"


# --- Pure helpers ---------------------------------------------------------------------


def normalise_email(email: str) -> str:
    """Emails are stored and compared in lower case with surrounding spaces removed, so
    `Asha@Uni.edu` and `asha@uni.edu` are one account."""
    return email.strip().lower()


def token_expires_at(now: datetime, ttl: timedelta) -> datetime:
    """When a password-reset token created at `now` stops working."""
    return now + ttl


def token_is_usable(expires_at: datetime, used_at: datetime | None, now: datetime) -> bool:
    """A reset token works once, and only strictly before its expiry."""
    return used_at is None and now < expires_at


def reset_link(raw_token: str) -> str:
    base = get_settings().frontend_base_url.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


def _now() -> datetime:
    return datetime.now(UTC)


@lru_cache
def _dummy_hash() -> str:
    # Verified against when the email is unknown, so a wrong email takes as long as a
    # wrong password and login timing doesn't reveal which emails have accounts.
    return hash_password("not-a-real-password")


# --- Errors ---------------------------------------------------------------------------


def _invalid_credentials() -> AppError:
    return AppError(
        "invalid_credentials",
        "The email or password is wrong. Check them and try again, or use 'Forgot password'.",
        status.HTTP_401_UNAUTHORIZED,
    )


def _email_taken() -> AppError:
    return AppError(
        "email_taken",
        "An account with this email already exists. Log in, or use 'Forgot password' to set "
        "a new password.",
        status.HTTP_409_CONFLICT,
    )


def _student_not_found() -> AppError:
    return AppError(
        "student_not_found",
        "No Student has this ID. Check the ID and try again.",
        status.HTTP_404_NOT_FOUND,
    )


def _club_not_found() -> AppError:
    return AppError(
        "club_not_found",
        "No Club has this ID. Check the link and try again.",
        status.HTTP_404_NOT_FOUND,
    )


# --- Lookups --------------------------------------------------------------------------


def get_student(db: Session, student_id: uuid.UUID) -> Student:
    student = db.get(Student, student_id)
    if student is None:
        raise _student_not_found()
    return student


def get_club(db: Session, club_id: uuid.UUID, *, lock: bool = False) -> Club:
    query = select(Club).where(Club.id == club_id)
    if lock:
        query = query.with_for_update()
    club = db.scalar(query)
    if club is None:
        raise _club_not_found()
    return club


def _student_by_email(db: Session, email: str) -> Student | None:
    return db.scalar(select(Student).where(Student.email == normalise_email(email)))


def _active_student_for_role(db: Session, student_id: uuid.UUID) -> Student:
    student = get_student(db, student_id)
    if student.status == StudentStatus.REMOVED:
        raise AppError(
            "student_removed",
            "This account has been removed, so it can't be given a Club Role.",
        )
    return student


def _role_out(role: ClubRole, student: Student) -> ClubRoleOut:
    return ClubRoleOut(student_id=student.id, name=student.name, role=role.role.value)


# --- Signup and login -----------------------------------------------------------------


def _add_student(db: Session, student: Student) -> Student:
    """Insert a new Student; 409 `email_taken` if the email is already used (also when two
    signups race past the pre-check and the unique index catches it)."""
    if _student_by_email(db, student.email) is not None:
        raise _email_taken()
    db.add(student)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _email_taken() from None
    return student


def signup(db: Session, body: SignupRequest) -> tuple[Student, str]:
    """Create an account and a login session. Returns the Student and the raw session token."""
    student = _add_student(
        db,
        Student(
            email=normalise_email(body.email),
            password_hash=hash_password(body.password),
            name=body.name,
            roll_no=body.roll_no,
            department=body.department,
            year=body.year,
            section=body.section,
        ),
    )
    return student, create_session(db, student)


def login(db: Session, email: str, password: str) -> tuple[Student, str]:
    """Check the password and start a session. Unknown email, wrong password, a removed
    account and an account without a password all give the same 401."""
    student = _student_by_email(db, email)
    if student is None or student.password_hash is None:
        # No hash to check (unknown email, or an admin-added account that hasn't set a
        # password): verify against a dummy so the 401 takes as long as a wrong password.
        verify_password(_dummy_hash(), password)
        raise _invalid_credentials()
    if not verify_password(student.password_hash, password):
        raise _invalid_credentials()
    if student.status != StudentStatus.ACTIVE:
        raise _invalid_credentials()
    if needs_rehash(student.password_hash):
        student.password_hash = hash_password(password)
    return student, create_session(db, student)


# --- Passwords ------------------------------------------------------------------------


def _create_reset_token(db: Session, student: Student, ttl: timedelta) -> str:
    raw = new_token()
    db.add(
        PasswordResetToken(
            student_id=student.id,
            token_hash=hash_token(raw),
            expires_at=token_expires_at(_now(), ttl),
        )
    )
    db.flush()
    return raw


def request_password_reset(db: Session, email: str) -> EmailMessage | None:
    """Create a reset token for an active account and return the email to send after the
    commit. Unknown and removed accounts return None and nothing is written."""
    student = _student_by_email(db, email)
    if student is None or student.status != StudentStatus.ACTIVE:
        return None
    ttl_minutes = get_settings().password_reset_ttl_minutes
    raw = _create_reset_token(db, student, timedelta(minutes=ttl_minutes))
    return EmailMessage(
        to=student.email,
        subject="Reset your ORGniser password",
        text=(
            f"Hi {student.name},\n\n"
            "Someone asked to reset the password for your ORGniser account. To choose a new "
            f"password, open this link within {ttl_minutes} minutes:\n\n"
            f"{reset_link(raw)}\n\n"
            "The link works once. If you didn't ask for this, ignore this email and your "
            "password stays the same.\n"
        ),
    )


def confirm_password_reset(db: Session, raw_token: str, new_password: str) -> None:
    """Set a new password from a valid, unused, unexpired token. The token is used up, any
    other outstanding tokens of the Student are cancelled and every session is revoked."""
    token = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == hash_token(raw_token))
        .with_for_update()
    )
    now = _now()
    student = db.get(Student, token.student_id) if token is not None else None
    if (
        token is None
        or student is None
        or student.status != StudentStatus.ACTIVE
        or not token_is_usable(token.expires_at, token.used_at, now)
    ):
        raise AppError(
            "invalid_token",
            "This password link is invalid, expired or already used. Ask for a new one with "
            "'Forgot password'.",
        )
    student.password_hash = hash_password(new_password)
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.student_id == student.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    revoke_all_sessions(db, student.id)
    db.flush()


def change_password(
    db: Session,
    student: Student,
    current_password: str,
    new_password: str,
    current_token: str | None,
) -> None:
    """Change the password of a logged-in Student and revoke their other sessions; the
    session making the request stays logged in."""
    if not verify_password(student.password_hash, current_password):
        raise AppError(
            "wrong_password",
            "Your current password is wrong. Type it again, or log out and use 'Forgot password'.",
        )
    student.password_hash = hash_password(new_password)
    query = update(LoginSession).where(
        LoginSession.student_id == student.id, LoginSession.revoked_at.is_(None)
    )
    if current_token:
        query = query.where(LoginSession.token_hash != hash_token(current_token))
    db.execute(query.values(revoked_at=_now()))
    db.flush()


def send_email(message: EmailMessage) -> None:
    """Send one account email. A failure is logged, not raised: the account change is
    already committed, and for password reset an error would reveal that the email has an
    account (decision 31)."""
    try:
        get_email_sender().send(message)
    except Exception:
        logger.exception("Could not send account email %r to %s", message.subject, message.to)


# --- Student Profile ------------------------------------------------------------------


def update_profile(db: Session, student: Student, body: StudentProfileUpdate) -> Student:
    """Change Student Profile fields. Email is not editable. Past Registrations keep their
    Profile Snapshot (rule 6), so nothing else changes."""
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(student, field, value)
    db.flush()
    return student


# --- Platform Admin: accounts ---------------------------------------------------------


def search_students(db: Session, roll_no: str | None, limit: int, offset: int) -> list[Student]:
    """All accounts (active and removed), or those whose roll number matches exactly,
    ignoring case. Roll numbers aren't unique (R2), so a search can return several."""
    query = select(Student)
    if roll_no is not None and roll_no.strip():
        query = query.where(func.lower(Student.roll_no) == roll_no.strip().lower())
    query = query.order_by(Student.created_at, Student.id).limit(limit).offset(offset)
    return list(db.scalars(query))


def admin_add_student(db: Session, body: AdminStudentCreate) -> tuple[Student, EmailMessage]:
    """Create a password-less account (R3) and return the set-password email to send after
    the commit. The link is a reset token valid for 7 days."""
    student = _add_student(
        db,
        Student(
            email=normalise_email(body.email),
            password_hash=None,
            name=body.name,
            roll_no=body.roll_no,
            department=body.department,
            year=body.year,
            section=body.section,
        ),
    )
    raw = _create_reset_token(db, student, SET_PASSWORD_TTL)
    message = EmailMessage(
        to=student.email,
        subject="Set your ORGniser password",
        text=(
            f"Hi {student.name},\n\n"
            "An ORGniser account has been made for you. To start using it, choose a password "
            f"with this link within {SET_PASSWORD_TTL.days} days:\n\n"
            f"{reset_link(raw)}\n\n"
            "The link works once. If it expires, use 'Forgot password' on the login page.\n"
        ),
    )
    return student, message


def remove_student(db: Session, admin: Student, student_id: uuid.UUID) -> None:
    """Mark the account Removed (decision 28): no login, every session revoked, every Club
    Role dropped and outstanding reset links cancelled. The row is never deleted, so its
    Registrations and Certificates keep their owner (ADR 0001). Removing twice is a no-op."""
    if student_id == admin.id:
        raise AppError(
            "cannot_remove_self",
            "You can't remove your own account. Ask another Platform Admin to do it.",
        )
    student = get_student(db, student_id)
    now = _now()
    if student.status != StudentStatus.REMOVED:
        student.status = StudentStatus.REMOVED
        student.removed_at = now
    revoke_all_sessions(db, student.id)
    db.execute(delete(ClubRole).where(ClubRole.student_id == student.id))
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.student_id == student.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    db.flush()


# --- Clubs and Club Roles -------------------------------------------------------------


def create_club(db: Session, body: ClubCreate) -> Club:
    """Create a Club under the first University row. If there is none yet, one named
    "University" is created (v1 serves a single university)."""
    if db.scalar(select(Club.id).where(Club.slug == body.slug)) is not None:
        raise _slug_taken()
    university = db.scalar(select(University).order_by(University.created_at, University.id))
    if university is None:
        university = University(name=DEFAULT_UNIVERSITY_NAME)
        db.add(university)
        db.flush()
    club = Club(university_id=university.id, name=body.name, slug=body.slug)
    db.add(club)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _slug_taken() from None
    return club


def _slug_taken() -> AppError:
    return AppError(
        "slug_taken",
        "Another Club already uses this slug. Choose a different one.",
        status.HTTP_409_CONFLICT,
    )


def assign_president(db: Session, club_id: uuid.UUID, student_id: uuid.UUID) -> ClubRoleOut:
    """Make `student_id` the Club's President (R4), replacing the current one, whose role is
    removed. A Coordinator of this Club is upgraded in place. The Club row is locked and the
    old President is deleted before the new one is written, so the one-President index holds."""
    get_club(db, club_id, lock=True)
    student = _active_student_for_role(db, student_id)

    current = db.scalar(
        select(ClubRole).where(ClubRole.club_id == club_id, ClubRole.role == ClubRoleKind.PRESIDENT)
    )
    if current is not None and current.student_id == student.id:
        return _role_out(current, student)
    if current is not None:
        db.delete(current)
        db.flush()

    existing = db.scalar(
        select(ClubRole).where(ClubRole.club_id == club_id, ClubRole.student_id == student.id)
    )
    if existing is not None:
        existing.role = ClubRoleKind.PRESIDENT
        role = existing
    else:
        role = ClubRole(club_id=club_id, student_id=student.id, role=ClubRoleKind.PRESIDENT)
        db.add(role)
    db.flush()
    return _role_out(role, student)


def list_club_roles(db: Session, club_id: uuid.UUID) -> list[ClubRoleOut]:
    """The Club's President first, then its Coordinators by name."""
    rows = db.execute(
        select(ClubRole, Student)
        .join(Student, Student.id == ClubRole.student_id)
        .where(ClubRole.club_id == club_id)
        .order_by(ClubRole.role != ClubRoleKind.PRESIDENT, Student.name, Student.id)
    ).all()
    return [_role_out(role, student) for role, student in rows]


def appoint_coordinator(db: Session, club_id: uuid.UUID, student_id: uuid.UUID) -> ClubRoleOut:
    """Give a Student the Coordinator role in this Club (R5)."""
    get_club(db, club_id)
    student = _active_student_for_role(db, student_id)
    if (
        db.scalar(
            select(ClubRole.id).where(
                ClubRole.club_id == club_id, ClubRole.student_id == student.id
            )
        )
        is not None
    ):
        raise _already_has_role()
    role = ClubRole(club_id=club_id, student_id=student.id, role=ClubRoleKind.COORDINATOR)
    db.add(role)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _already_has_role() from None
    return _role_out(role, student)


def _already_has_role() -> AppError:
    return AppError(
        "already_has_role",
        "This Student already holds a Club Role in this Club.",
        status.HTTP_409_CONFLICT,
    )


def remove_coordinator(db: Session, club_id: uuid.UUID, student_id: uuid.UUID) -> None:
    """Take the Coordinator role away (R5). The President can't be removed this way; the
    Platform Admin replaces them with `PUT /admin/clubs/{id}/president`."""
    get_club(db, club_id)
    role = db.scalar(
        select(ClubRole).where(ClubRole.club_id == club_id, ClubRole.student_id == student_id)
    )
    if role is None:
        raise AppError(
            "coordinator_not_found",
            "This Student isn't a Coordinator of this Club.",
            status.HTTP_404_NOT_FOUND,
        )
    if role.role == ClubRoleKind.PRESIDENT:
        raise AppError(
            "cannot_remove_president",
            "This Student is the Club's President, not a Coordinator. The Platform Admin "
            "replaces the President instead.",
        )
    db.delete(role)
    db.flush()
