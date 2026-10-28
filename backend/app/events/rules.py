"""Registration Form and Eligibility Rule logic (P2).

Pure functions: no database, no FastAPI, no storage. They take ORM rows or Pydantic
models alike (attribute access through the small Protocols below) and are wired into
the services elsewhere.

- `check_eligibility` reads Student Profile fields only, never answers (domain rule 5).
- `validate_answers` validates and normalizes a Registration's answers (R9).
- `check_form_edit` enforces what may change once answers exist (R10).
- `profile_snapshot` builds the Profile Snapshot copied into a Registration (R8, rule 6).
- `is_open` decides whether registration is Open (R15).
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable, Mapping, Sequence
from datetime import UTC, date, datetime
from typing import Any, Protocol

from email_validator import EmailNotValidError, validate_email

from app.events.schemas import FormFieldType

__all__ = [
    "PROFILE_FIELDS",
    "FieldLike",
    "FormError",
    "RuleLike",
    "check_eligibility",
    "check_form_edit",
    "is_open",
    "profile_snapshot",
    "validate_answers",
]

#: Profile Snapshot keys, in their fixed order (`captured_at` is appended).
PROFILE_FIELDS: tuple[str, ...] = ("name", "roll_no", "department", "year", "section")

KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,49}$")
SHORT_TEXT_MAX = 200
LONG_TEXT_MAX = 5000
PHONE_ALLOWED_RE = re.compile(r"^\+?[0-9 \-]+$")
PHONE_MIN_DIGITS = 7
PHONE_MAX_DIGITS = 15
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CHOICE_TYPES = frozenset({"single_choice", "multi_choice"})
ELIGIBILITY_FIELDS = frozenset({"department", "year", "section"})


class RuleLike(Protocol):
    """An Eligibility Rule: an ORM row or `schemas.EligibilityRule`."""

    field: str
    operator: str
    values: Sequence[Any]


class FieldLike(Protocol):
    """A Form Field: an ORM row or `schemas.FormField`."""

    key: str
    label: str
    type: FormFieldType | str
    required: bool
    options: Sequence[str] | None
    hidden: bool


class FormError(ValueError):
    """A Registration Form problem the client can fix.

    `code` is machine-readable; `errors` maps a Form Field key to a message.
    """

    def __init__(self, code: str, message: str, errors: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.errors: dict[str, str] = dict(errors or {})


# --------------------------------------------------------------------------- helpers


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, Mapping):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _norm_str(value: Any) -> str:
    return str(value).strip().casefold()


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return isinstance(value, list | tuple) and len(value) == 0


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


# --------------------------------------------------------------------------- eligibility


def check_eligibility(profile: Mapping[str, Any], rules: Iterable[RuleLike]) -> list[str]:
    """Return the descriptions of the Eligibility Rules the profile fails.

    An empty list means the Student is eligible. Rules are ANDed. Only Student Profile
    fields are read (domain rule 5). Strings compare trimmed and case-insensitively;
    `year` compares as an int.
    """
    failed: list[str] = []
    for rule in rules:
        field = rule.field
        operator = getattr(rule, "operator", "in") or "in"
        if field not in ELIGIBILITY_FIELDS:
            raise ValueError(f"Unsupported eligibility field: {field!r}")
        if operator != "in":
            raise ValueError(f"Unsupported eligibility operator: {operator!r}")

        values = list(rule.values or [])
        description = f"{field} must be one of: {', '.join(str(v).strip() for v in values)}"
        actual = profile.get(field)

        if field == "year":
            actual_year = _as_int(actual)
            allowed = {y for y in (_as_int(v) for v in values) if y is not None}
            ok = actual_year is not None and actual_year in allowed
        else:
            ok = not _is_empty(actual) and _norm_str(actual) in {_norm_str(v) for v in values}

        if not ok:
            failed.append(description)
    return failed


# --------------------------------------------------------------------------- answers


def _clean_value(field: FieldLike, value: Any) -> Any:
    """Return the normalized value, or raise ValueError with a user-facing message."""
    ftype = field.type
    options = list(field.options or [])

    if ftype in ("short_text", "long_text"):
        if not isinstance(value, str):
            raise ValueError("Must be text.")
        text = value.strip()
        limit = SHORT_TEXT_MAX if ftype == "short_text" else LONG_TEXT_MAX
        if len(text) > limit:
            raise ValueError(f"Must be at most {limit} characters.")
        return text

    if ftype == "number":
        number: int | float
        if isinstance(value, bool):
            raise ValueError("Must be a number.")
        if isinstance(value, int | float):
            number = value
        elif isinstance(value, str):
            try:
                number = float(value.strip())
            except ValueError:
                raise ValueError("Must be a number.") from None
        else:
            raise ValueError("Must be a number.")
        if isinstance(number, float):
            if not math.isfinite(number):
                raise ValueError("Must be a finite number.")
            if number.is_integer():
                number = int(number)
        return number

    if ftype == "email":
        if not isinstance(value, str):
            raise ValueError("Must be an email address.")
        try:
            result = validate_email(value.strip(), check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("Must be a valid email address.") from None
        return result.normalized

    if ftype == "phone":
        if not isinstance(value, str):
            raise ValueError("Must be a phone number.")
        phone = value.strip()
        digits = sum(ch.isdigit() for ch in phone)
        if not PHONE_ALLOWED_RE.match(phone) or not PHONE_MIN_DIGITS <= digits <= PHONE_MAX_DIGITS:
            raise ValueError(
                f"Must be a phone number of {PHONE_MIN_DIGITS}-{PHONE_MAX_DIGITS} digits "
                "(digits, +, spaces and dashes only)."
            )
        return phone

    if ftype == "date":
        if isinstance(value, datetime):
            raise ValueError("Must be a date in YYYY-MM-DD format.")
        if isinstance(value, date):
            return value.isoformat()
        if not isinstance(value, str) or not ISO_DATE_RE.match(value.strip()):
            raise ValueError("Must be a date in YYYY-MM-DD format.")
        try:
            return date.fromisoformat(value.strip()).isoformat()
        except ValueError:
            raise ValueError("Must be a real date in YYYY-MM-DD format.") from None

    if ftype == "single_choice":
        if not isinstance(value, str) or value.strip() not in options:
            raise ValueError("Must be one of the listed options.")
        return value.strip()

    if ftype == "multi_choice":
        if not isinstance(value, list | tuple):
            raise ValueError("Must be a list of options.")
        cleaned: list[str] = []
        for item in value:
            if not isinstance(item, str) or item.strip() not in options:
                raise ValueError(f"{item!r} is not one of the listed options.")
            if item.strip() in cleaned:
                raise ValueError(f"{item.strip()!r} is chosen more than once.")
            cleaned.append(item.strip())
        return cleaned

    if ftype == "yes_no":
        if not isinstance(value, bool):
            raise ValueError("Must be yes or no (true/false).")
        return value

    raise ValueError(f"Unsupported field type {ftype!r}.")


def validate_answers(fields: Sequence[FieldLike], answers: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and normalize a Registration's answers against its Form Fields.

    Returns the cleaned answers. Empty optional answers are dropped. Hidden fields are
    never required; if an answer for one is sent it is still validated. Unknown keys
    are rejected.

    Raises `FormError(code="invalid_answers")` with `errors: {key: message}`.
    """
    by_key = {f.key: f for f in fields}
    errors: dict[str, str] = {}
    cleaned: dict[str, Any] = {}

    for key in answers:
        if key not in by_key:
            errors[key] = "Unknown field."

    for key, field in by_key.items():
        value = answers.get(key)
        if _is_empty(value):
            if field.required and not field.hidden:
                errors[key] = "This field is required."
            continue
        try:
            cleaned[key] = _clean_value(field, value)
        except ValueError as exc:
            errors[key] = str(exc)

    if errors:
        raise FormError("invalid_answers", "Some answers are invalid.", errors)
    return cleaned


# --------------------------------------------------------------------------- form edits


def check_form_edit(
    old_fields: Sequence[FieldLike],
    new_fields: Sequence[FieldLike],
    answered_keys: set[str],
    has_registrations: bool = False,
) -> None:
    """Enforce R10 on a Registration Form edit. Returns None when the edit is allowed.

    - Keys must be slug-like (`bad_key`) and unique (`duplicate_key`).
    - A field with answers can't be deleted, retyped, or lose choice options
      (`field_locked`). It can be hidden instead; adding options is fine.
    - Once any Registration exists, no new required field can be added, and no
      existing field can become required (`required_field_blocked`).
    """
    seen: set[str] = set()
    for field in new_fields:
        key = field.key
        if not isinstance(key, str) or not KEY_RE.match(key):
            raise FormError(
                "bad_key",
                f"Field key {key!r} is invalid. Use 1-50 lowercase letters, digits or "
                "underscores, starting with a letter (e.g. 'tshirt_size').",
                {str(key): "Invalid key."},
            )
        if key in seen:
            raise FormError(
                "duplicate_key",
                f"Field key {key!r} is used more than once. Give each field its own key.",
                {key: "Duplicate key."},
            )
        seen.add(key)

    old_by_key = {f.key: f for f in old_fields}
    new_by_key = {f.key: f for f in new_fields}

    for key in sorted(answered_keys):
        old = old_by_key.get(key)
        if old is None:
            continue
        new = new_by_key.get(key)
        if new is None:
            raise FormError(
                "field_locked",
                f"Field {key!r} already has answers, so it can't be deleted. "
                "Hide it instead (set hidden to true).",
                {key: "Has answers: hide it instead of deleting."},
            )
        if new.type != old.type:
            raise FormError(
                "field_locked",
                f"Field {key!r} already has answers, so its type can't change from "
                f"{old.type!r} to {new.type!r}. Hide it and add a new field instead.",
                {key: "Has answers: type is locked."},
            )
        if old.type in CHOICE_TYPES:
            removed = [o for o in (old.options or []) if o not in set(new.options or [])]
            if removed:
                raise FormError(
                    "field_locked",
                    f"Field {key!r} already has answers, so options can't be removed "
                    f"({', '.join(map(repr, removed))}). Keep them; you may add new ones.",
                    {key: "Has answers: options can only be added."},
                )

    if has_registrations:
        for field in new_fields:
            old = old_by_key.get(field.key)
            if field.required and (old is None or not old.required):
                what = "added as a required field" if old is None else "made required"
                raise FormError(
                    "required_field_blocked",
                    f"Field {field.key!r} can't be {what} because Registrations already "
                    "exist and they have no answer for it. Make it optional instead.",
                    {field.key: "Registrations exist: must be optional."},
                )


# --------------------------------------------------------------------------- snapshot


def profile_snapshot(student: Any, now: datetime | None = None) -> dict[str, Any]:
    """Return the Profile Snapshot for a Student (object or mapping), in a fixed key order:
    name, roll_no, department, year, section, captured_at (ISO, UTC)."""
    captured = _as_utc(now) if now is not None else datetime.now(UTC)
    snapshot = {name: _get(student, name) for name in PROFILE_FIELDS}
    snapshot["captured_at"] = captured.isoformat()
    return snapshot


# --------------------------------------------------------------------------- open/closed


def is_open(
    manually_closed: bool,
    registration_deadline: datetime | None,
    seat_limit: int | None,
    confirmed_count: int,
    now: datetime,
) -> tuple[bool, str | None]:
    """Return `(open, reason)`; reason is `closed_by_club`, `deadline_passed` or `full`.

    Checked in that order. The deadline has passed once `now >= registration_deadline`.
    Naive datetimes are treated as UTC.
    """
    if manually_closed:
        return False, "closed_by_club"
    if registration_deadline is not None and _as_utc(now) >= _as_utc(registration_deadline):
        return False, "deadline_passed"
    if seat_limit is not None and confirmed_count >= seat_limit:
        return False, "full"
    return True, None
