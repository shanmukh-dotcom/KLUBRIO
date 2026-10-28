"""Login sessions behind an HTTP-only cookie, and the FastAPI dependencies that read them
(decisions 24, 25, 28).

The cookie holds a random token; `sessions` stores only its SHA-256 hash. A session
counts only while it is unrevoked, unexpired and its Student is `active`, so logout,
password reset and account removal take effect at once.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.accounts.models import LoginSession, Student, StudentStatus
from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import hash_token, new_token
from app.core.settings import get_settings

DbSession = Annotated[Session, Depends(get_session)]


def _now() -> datetime:
    return datetime.now(UTC)


def create_session(db: Session, student: Student) -> str:
    """Start a login session for `student` and return the raw token for the cookie.

    Only the token's hash is stored. The caller commits.
    """
    token = new_token()
    db.add(
        LoginSession(
            student_id=student.id,
            token_hash=hash_token(token),
            expires_at=_now() + timedelta(days=get_settings().session_ttl_days),
        )
    )
    db.flush()
    return token


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def revoke_session(db: Session, token: str) -> None:
    """Revoke the session behind `token` (logout). Unknown or already-revoked tokens are a
    no-op. The caller commits."""
    db.execute(
        update(LoginSession)
        .where(LoginSession.token_hash == hash_token(token), LoginSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def revoke_all_sessions(db: Session, student_id: uuid.UUID) -> None:
    """Revoke every live session of a Student (password reset, account removal).
    The caller commits."""
    db.execute(
        update(LoginSession)
        .where(LoginSession.student_id == student_id, LoginSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def student_for_token(db: Session, token: str) -> Student | None:
    """The active Student behind a live session token, or None."""
    return db.scalar(
        select(Student)
        .join(LoginSession, LoginSession.student_id == Student.id)
        .where(
            LoginSession.token_hash == hash_token(token),
            LoginSession.revoked_at.is_(None),
            LoginSession.expires_at > _now(),
            Student.status == StudentStatus.ACTIVE,
        )
    )


def optional_student(request: Request, db: DbSession) -> Student | None:
    """FastAPI dependency: the logged-in Student, or None when there's no valid session."""
    token = request.cookies.get(get_settings().session_cookie_name)
    if not token:
        return None
    return student_for_token(db, token)


OptionalStudent = Annotated[Student | None, Depends(optional_student)]


def current_student(student: OptionalStudent) -> Student:
    """FastAPI dependency: the logged-in Student; 401 when not logged in."""
    if student is None:
        raise AppError(
            "not_authenticated",
            "You need to log in to do this. Log in and try again.",
            status.HTTP_401_UNAUTHORIZED,
        )
    return student


CurrentStudent = Annotated[Student, Depends(current_student)]


def require_platform_admin(student: CurrentStudent) -> Student:
    """FastAPI dependency: the logged-in Student, who must be the Platform Admin; else 403."""
    if not student.is_platform_admin:
        raise AppError(
            "forbidden",
            "Only the Platform Admin can do this.",
            status.HTTP_403_FORBIDDEN,
        )
    return student


PlatformAdmin = Annotated[Student, Depends(require_platform_admin)]
