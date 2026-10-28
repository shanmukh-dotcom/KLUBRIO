"""Pure tests for the events schemas and the service's error mapping (no database)."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.events.rules import FormError
from app.events.schemas import EligibilityRule, EventCreate, EventUpdate, RegistrationFormIn
from app.events.service import _form_error

NOW = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)


def create(**overrides):
    values = dict(name="Hackathon", starts_at=NOW, ends_at=NOW + timedelta(hours=3))
    values.update(overrides)
    return EventCreate(**values)


def test_valid_event_create():
    event = create(seat_limit=40, registration_deadline=NOW - timedelta(days=1))
    assert event.seat_limit == 40


def test_ends_must_be_after_start():
    with pytest.raises(ValidationError, match="ends_at must be after starts_at"):
        create(ends_at=NOW)


def test_seat_limit_at_least_one():
    with pytest.raises(ValidationError):
        create(seat_limit=0)


@pytest.mark.parametrize("field", ["starts_at", "registration_deadline"])
def test_naive_datetimes_rejected(field):
    naive = datetime(2026, 11, 1, 10, 0)
    overrides = {field: naive}
    if field == "starts_at":
        overrides["ends_at"] = NOW + timedelta(days=1)
    with pytest.raises(ValidationError):
        create(**overrides)


def test_iso_string_with_offset_is_accepted():
    event = EventCreate.model_validate(
        {
            "name": "x",
            "starts_at": "2026-11-01T10:00:00+05:30",
            "ends_at": "2026-11-01T12:00:00+05:30",
        }
    )
    assert event.starts_at.utcoffset() == timedelta(hours=5, minutes=30)


def test_empty_name_rejected():
    with pytest.raises(ValidationError):
        create(name="")


def test_update_partial_and_null_rules():
    assert EventUpdate(venue="Hall A").model_dump(exclude_unset=True) == {"venue": "Hall A"}
    # Clearing the Seat Limit / Deadline is allowed.
    cleared = EventUpdate(seat_limit=None, registration_deadline=None)
    assert cleared.model_dump(exclude_unset=True) == {
        "seat_limit": None,
        "registration_deadline": None,
    }
    with pytest.raises(ValidationError, match="name can't be null"):
        EventUpdate(name=None)
    with pytest.raises(ValidationError, match="ends_at must be after"):
        EventUpdate(starts_at=NOW, ends_at=NOW - timedelta(hours=1))
    with pytest.raises(ValidationError):
        EventUpdate(starts_at=datetime(2026, 1, 1))
    with pytest.raises(ValidationError):
        EventUpdate(seat_limit=0)


def test_form_field_key_pattern():
    with pytest.raises(ValidationError):
        RegistrationFormIn.model_validate(
            {"fields": [{"key": "Bad Key", "label": "x", "type": "short_text"}]}
        )


def test_eligibility_rule_profile_fields_only():
    with pytest.raises(ValidationError):
        EligibilityRule.model_validate({"field": "tshirt", "values": ["M"]})
    with pytest.raises(ValidationError):
        EligibilityRule(field="year", values=[])


def test_form_error_mapping():
    locked = _form_error(FormError("field_locked", "Locked.", {"a": "Has answers."}))
    assert (locked.code, locked.status_code) == ("field_locked", 409)
    assert "a: Has answers." in locked.message
    blocked = _form_error(FormError("required_field_blocked", "Blocked."))
    assert blocked.status_code == 409
    bad = _form_error(FormError("duplicate_key", "Dup.", {"x": "Duplicate key."}))
    assert (bad.code, bad.status_code) == ("duplicate_key", 400)
