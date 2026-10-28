"""Request/response models for accounts (P6)."""

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class StudentProfile(BaseModel):
    name: str = Field(max_length=200)
    roll_no: str = Field(max_length=50)
    department: str = Field(max_length=100)
    year: int = Field(ge=1, le=10)
    section: str = Field(max_length=20)


class StudentProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    roll_no: str | None = Field(default=None, max_length=50)
    department: str | None = Field(default=None, max_length=100)
    year: int | None = Field(default=None, ge=1, le=10)
    section: str | None = Field(default=None, max_length=20)


class SignupRequest(StudentProfile):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AdminStudentCreate(StudentProfile):
    """Platform Admin adds an account; the Student sets their own password from an email."""

    email: EmailStr


class StudentOut(StudentProfile):
    id: uuid.UUID
    email: EmailStr
    is_platform_admin: bool
    status: Literal["active", "removed"]


class ClubCreate(BaseModel):
    name: str = Field(max_length=200)
    slug: str = Field(max_length=100, pattern=r"^[a-z0-9-]+$")


class ClubOut(ClubCreate):
    id: uuid.UUID
    university_id: uuid.UUID


class AssignPresident(BaseModel):
    student_id: uuid.UUID


class AppointCoordinator(BaseModel):
    student_id: uuid.UUID


class ClubRoleOut(BaseModel):
    student_id: uuid.UUID
    name: str
    role: Literal["president", "coordinator"]
