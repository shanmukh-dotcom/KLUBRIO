"""HTTP routes for accounts (P6): R1-R6; decisions 24, 25, 28, 31.

Login sets an HTTP-only session cookie (decision 25); every other endpoint reads it.
Business logic lives in `app.accounts.service`; handlers check permissions, call it and
commit.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status

from app.accounts import service
from app.accounts.schemas import (
    AdminStudentCreate,
    AppointCoordinator,
    AssignPresident,
    ClubCreate,
    ClubOut,
    ClubRoleOut,
    LoginRequest,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignupRequest,
    StudentOut,
    StudentProfileUpdate,
)
from app.core.auth import (
    CurrentStudent,
    DbSession,
    PlatformAdmin,
    clear_session_cookie,
    revoke_session,
    set_session_cookie,
)
from app.core.errors import ErrorResponse
from app.core.permissions import require_club_member, require_president
from app.core.ratelimit import login_rate_limit
from app.core.settings import get_settings

router = APIRouter(tags=["accounts"])


def _err(description: str) -> dict:
    return {"model": ErrorResponse, "description": description}


UNAUTHENTICATED = {status.HTTP_401_UNAUTHORIZED: _err("Not logged in.")}
FORBIDDEN = {
    **UNAUTHENTICATED,
    status.HTTP_403_FORBIDDEN: _err("Not allowed for this account."),
}
RATE_LIMITED = {status.HTTP_429_TOO_MANY_REQUESTS: _err("Too many requests; wait a minute.")}


def _session_token(request: Request) -> str | None:
    return request.cookies.get(get_settings().session_cookie_name)


def _student_out(student) -> StudentOut:
    return StudentOut.model_validate(student, from_attributes=True)


# --- Auth -----------------------------------------------------------------------------


@router.post(
    "/auth/signup",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: _err("`email_taken`: the email has an account.")},
)
def signup(body: SignupRequest, response: Response, db: DbSession) -> StudentOut:
    """Create an account and log in (sets the session cookie). Emails are stored in lower case."""
    student, token = service.signup(db, body)
    db.commit()
    set_session_cookie(response, token)
    return _student_out(student)


@router.post(
    "/auth/login",
    response_model=StudentOut,
    dependencies=[Depends(login_rate_limit)],
    responses={
        status.HTTP_401_UNAUTHORIZED: _err("`invalid_credentials`: wrong email or password."),
        **RATE_LIMITED,
    },
)
def login(body: LoginRequest, response: Response, db: DbSession) -> StudentOut:
    """Sets the session cookie. Fails for Removed accounts. Rate-limited."""
    student, token = service.login(db, body.email, body.password)
    db.commit()
    set_session_cookie(response, token)
    return _student_out(student)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession) -> None:
    """Revokes the current session and clears the cookie. 204 even when not logged in."""
    token = _session_token(request)
    if token:
        revoke_session(db, token)
        db.commit()
    clear_session_cookie(response)


@router.post(
    "/auth/password-reset",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(login_rate_limit)],
    responses=RATE_LIMITED,
)
def request_password_reset(
    body: PasswordResetRequest, db: DbSession, background: BackgroundTasks
) -> None:
    """Emails a one-time reset link. Always returns 202, so it never reveals whether an
    email has an account. Rate-limited. The email is sent after the response, so response
    time doesn't reveal it either."""
    message = service.request_password_reset(db, body.email)
    if message is not None:
        db.commit()
        background.add_task(service.send_email, message)


@router.post(
    "/auth/password-reset/confirm",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_400_BAD_REQUEST: _err("`invalid_token`: invalid, expired or used link.")
    },
)
def confirm_password_reset(body: PasswordResetConfirm, db: DbSession) -> None:
    """Sets a new password from a reset token and revokes all existing sessions."""
    service.confirm_password_reset(db, body.token, body.new_password)
    db.commit()


@router.post(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **UNAUTHENTICATED,
        status.HTTP_400_BAD_REQUEST: _err("`wrong_password`: current password is wrong."),
    },
)
def change_password(
    body: PasswordChange, request: Request, student: CurrentStudent, db: DbSession
) -> None:
    """Change your password. Your other sessions are logged out; this one stays."""
    service.change_password(
        db, student, body.current_password, body.new_password, _session_token(request)
    )
    db.commit()


# --- Student Profile ------------------------------------------------------------------


@router.get("/me", response_model=StudentOut, responses=UNAUTHENTICATED)
def get_me(student: CurrentStudent) -> StudentOut:
    return _student_out(student)


@router.patch("/me", response_model=StudentOut, responses=UNAUTHENTICATED)
def update_me(body: StudentProfileUpdate, student: CurrentStudent, db: DbSession) -> StudentOut:
    """Edit your Student Profile. Email can't be changed here."""
    service.update_profile(db, student, body)
    db.commit()
    return _student_out(student)


# --- Platform Admin -------------------------------------------------------------------


@router.get("/admin/students", response_model=list[StudentOut], responses=FORBIDDEN)
def search_students(
    admin: PlatformAdmin,
    db: DbSession,
    roll_no: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[StudentOut]:
    """List every account, or with `roll_no` only exact (case-insensitive) matches.
    Paginated with `limit` (default 50, max 200) and `offset`."""
    return [_student_out(s) for s in service.search_students(db, roll_no, limit, offset)]


@router.post(
    "/admin/students",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        **FORBIDDEN,
        status.HTTP_409_CONFLICT: _err("`email_taken`: the email has an account."),
    },
)
def add_student(body: AdminStudentCreate, admin: PlatformAdmin, db: DbSession) -> StudentOut:
    """Platform Admin adds an account (R3). The Student is emailed a link to set a password
    (valid 7 days)."""
    student, message = service.admin_add_student(db, body)
    db.commit()
    service.send_email(message)
    return _student_out(student)


@router.delete(
    "/admin/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **FORBIDDEN,
        status.HTTP_400_BAD_REQUEST: _err("`cannot_remove_self`."),
        status.HTTP_404_NOT_FOUND: _err("`student_not_found`."),
    },
)
def remove_student(student_id: uuid.UUID, admin: PlatformAdmin, db: DbSession) -> None:
    """Marks the account Removed: no login, sessions and Club Roles dropped. The row stays,
    so their Registrations and Certificates are kept (ADR 0001)."""
    service.remove_student(db, admin, student_id)
    db.commit()


@router.post(
    "/admin/clubs",
    response_model=ClubOut,
    status_code=status.HTTP_201_CREATED,
    responses={**FORBIDDEN, status.HTTP_409_CONFLICT: _err("`slug_taken`.")},
)
def create_club(body: ClubCreate, admin: PlatformAdmin, db: DbSession) -> ClubOut:
    club = service.create_club(db, body)
    db.commit()
    return ClubOut.model_validate(club, from_attributes=True)


@router.put(
    "/admin/clubs/{club_id}/president",
    response_model=ClubRoleOut,
    responses={
        **FORBIDDEN,
        status.HTTP_400_BAD_REQUEST: _err("`student_removed`."),
        status.HTTP_404_NOT_FOUND: _err("`club_not_found` or `student_not_found`."),
    },
)
def assign_president(
    club_id: uuid.UUID, body: AssignPresident, admin: PlatformAdmin, db: DbSession
) -> ClubRoleOut:
    """Assign the Club's President, replacing the current one (R4)."""
    role = service.assign_president(db, club_id, body.student_id)
    db.commit()
    return role


# --- Club Roles -----------------------------------------------------------------------


@router.get(
    "/clubs/{club_id}/roles",
    response_model=list[ClubRoleOut],
    responses={**FORBIDDEN, status.HTTP_404_NOT_FOUND: _err("`club_not_found`.")},
)
def list_club_roles(
    club_id: uuid.UUID, student: CurrentStudent, db: DbSession
) -> list[ClubRoleOut]:
    """Any member of the Club (President or Coordinator), or the Platform Admin."""
    require_club_member(db, student, club_id)
    service.get_club(db, club_id)
    return service.list_club_roles(db, club_id)


@router.post(
    "/clubs/{club_id}/coordinators",
    response_model=ClubRoleOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        **FORBIDDEN,
        status.HTTP_400_BAD_REQUEST: _err("`student_removed`."),
        status.HTTP_404_NOT_FOUND: _err("`club_not_found` or `student_not_found`."),
        status.HTTP_409_CONFLICT: _err("`already_has_role`."),
    },
)
def appoint_coordinator(
    club_id: uuid.UUID, body: AppointCoordinator, student: CurrentStudent, db: DbSession
) -> ClubRoleOut:
    """President only (R5)."""
    require_president(db, student, club_id)
    role = service.appoint_coordinator(db, club_id, body.student_id)
    db.commit()
    return role


@router.delete(
    "/clubs/{club_id}/coordinators/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **FORBIDDEN,
        status.HTTP_400_BAD_REQUEST: _err("`cannot_remove_president`."),
        status.HTTP_404_NOT_FOUND: _err("`club_not_found` or `coordinator_not_found`."),
    },
)
def remove_coordinator(
    club_id: uuid.UUID, student_id: uuid.UUID, student: CurrentStudent, db: DbSession
) -> None:
    """President only (R5). The President can't be removed through this route."""
    require_president(db, student, club_id)
    service.remove_coordinator(db, club_id, student_id)
    db.commit()
