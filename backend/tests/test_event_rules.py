"""Pure tests for app.events.rules (R8-R11, R15; domain rules 5 and 6)."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.events.rules import (
    FormError,
    check_eligibility,
    check_form_edit,
    is_open,
    profile_snapshot,
    validate_answers,
)
from app.events.schemas import EligibilityRule, FormField


def field(key, type_="short_text", required=False, options=None, hidden=False, label=None):
    return FormField(
        key=key,
        label=label or key.title(),
        type=type_,
        required=required,
        options=options or [],
        hidden=hidden,
    )


# --------------------------------------------------------------------------- eligibility

PROFILE = {"name": "Asha", "department": "CSE", "year": "3", "section": "A"}


def test_eligible_with_no_rules():
    assert check_eligibility(PROFILE, []) == []


def test_rules_are_anded_and_all_pass():
    rules = [
        EligibilityRule(field="year", values=["3"]),
        EligibilityRule(field="department", values=[" cse ", "ECE"]),
        EligibilityRule(field="section", values=["a"]),
    ]
    assert check_eligibility(PROFILE, rules) == []


def test_one_failing_rule_makes_ineligible():
    rules = [
        EligibilityRule(field="year", values=["3"]),
        EligibilityRule(field="department", values=["ECE"]),
    ]
    failed = check_eligibility(PROFILE, rules)
    assert failed == ["department must be one of: ECE"]


def test_all_failures_are_listed():
    rules = [
        EligibilityRule(field="year", values=["4"]),
        EligibilityRule(field="department", values=["ECE"]),
    ]
    assert len(check_eligibility(PROFILE, rules)) == 2


def test_year_compares_as_int_against_string_profile_value():
    rules = [EligibilityRule(field="year", values=["03", "4"])]
    assert check_eligibility({"year": " 3 "}, rules) == []
    assert check_eligibility({"year": 3}, rules) == []
    assert check_eligibility({"year": "2"}, rules) != []
    assert check_eligibility({"year": "third"}, rules) != []


def test_missing_profile_field_fails():
    rules = [EligibilityRule(field="section", values=["A"])]
    assert check_eligibility({"department": "CSE"}, rules) != []


def test_eligibility_never_reads_answers():
    # An "answers" key in the mapping or a matching answer value must not help (rule 5).
    rules = [EligibilityRule(field="department", values=["ECE"])]
    profile = {"department": "CSE", "answers": {"department": "ECE"}}
    assert check_eligibility(profile, rules) != []


def test_eligibility_accepts_orm_like_rows():
    row = SimpleNamespace(field="department", operator="in", values=["CSE"])
    assert check_eligibility(PROFILE, [row]) == []


def test_unsupported_operator_raises():
    row = SimpleNamespace(field="department", operator="not_in", values=["CSE"])
    with pytest.raises(ValueError):
        check_eligibility(PROFILE, [row])


# --------------------------------------------------------------------------- answers


def errors_for(fields, answers):
    with pytest.raises(FormError) as exc:
        validate_answers(fields, answers)
    assert exc.value.code == "invalid_answers"
    return exc.value.errors


def test_valid_answers_are_normalized():
    fields = [
        field("tshirt", "single_choice", options=["S", "M", "L"]),
        field("bio", "long_text"),
        field("nick", "short_text"),
        field("age", "number"),
        field("mail", "email"),
        field("phone", "phone"),
        field("dob", "date"),
        field("langs", "multi_choice", options=["py", "go"]),
        field("veg", "yes_no"),
    ]
    cleaned = validate_answers(
        fields,
        {
            "tshirt": " M ",
            "bio": "  hi  ",
            "nick": "Ash",
            "age": "21",
            "mail": "Asha@Example.com",
            "phone": "+91 98765-43210",
            "dob": "2004-02-29",
            "langs": ["py", "go"],
            "veg": False,
        },
    )
    assert cleaned == {
        "tshirt": "M",
        "bio": "hi",
        "nick": "Ash",
        "age": 21,
        "mail": "Asha@example.com",
        "phone": "+91 98765-43210",
        "dob": "2004-02-29",
        "langs": ["py", "go"],
        "veg": False,
    }


def test_short_text_limit():
    fields = [field("a", "short_text")]
    assert validate_answers(fields, {"a": "x" * 200}) == {"a": "x" * 200}
    assert "a" in errors_for(fields, {"a": "x" * 201})
    assert "a" in errors_for(fields, {"a": 5})


def test_long_text_limit():
    fields = [field("a", "long_text")]
    assert validate_answers(fields, {"a": "x" * 5000})["a"] == "x" * 5000
    assert "a" in errors_for(fields, {"a": "x" * 5001})


@pytest.mark.parametrize("value", ["abc", True, "nan", "inf", [1]])
def test_number_invalid(value):
    assert "n" in errors_for([field("n", "number")], {"n": value})


def test_number_keeps_floats():
    assert validate_answers([field("n", "number")], {"n": "2.5"}) == {"n": 2.5}
    assert validate_answers([field("n", "number")], {"n": 7}) == {"n": 7}


@pytest.mark.parametrize("value", ["not-an-email", "a@", 42])
def test_email_invalid(value):
    assert "e" in errors_for([field("e", "email")], {"e": value})


@pytest.mark.parametrize(
    "value", ["123456", "1234567890123456", "98765abc12", "(987) 654-3210", 9876543210]
)
def test_phone_invalid(value):
    assert "p" in errors_for([field("p", "phone")], {"p": value})


@pytest.mark.parametrize("value", ["1234567", "123456789012345", "+44 20-7946-0958"])
def test_phone_valid(value):
    assert validate_answers([field("p", "phone")], {"p": value}) == {"p": value}


@pytest.mark.parametrize("value", ["25/10/2026", "2026-13-01", "2026-02-30", "2026-1-1", 20261025])
def test_date_invalid(value):
    assert "d" in errors_for([field("d", "date")], {"d": value})


def test_single_choice_must_be_an_option():
    fields = [field("c", "single_choice", options=["A", "B"])]
    assert "c" in errors_for(fields, {"c": "C"})
    assert "c" in errors_for(fields, {"c": ["A"]})


def test_multi_choice_rules():
    fields = [field("m", "multi_choice", options=["A", "B"])]
    assert "m" in errors_for(fields, {"m": "A"})  # not a list
    assert "m" in errors_for(fields, {"m": ["A", "C"]})  # not an option
    assert "m" in errors_for(fields, {"m": ["A", "A"]})  # duplicate


@pytest.mark.parametrize("value", ["yes", 1, "true"])
def test_yes_no_must_be_bool(value):
    assert "y" in errors_for([field("y", "yes_no")], {"y": value})


@pytest.mark.parametrize("value", [None, "", "   ", []])
def test_required_must_be_present_and_non_empty(value):
    fields = [field("r", "short_text", required=True)]
    assert errors_for(fields, {"r": value}) == {"r": "This field is required."}


def test_required_missing_key():
    assert "r" in errors_for([field("r", required=True)], {})


def test_required_multi_choice_empty_list():
    fields = [field("m", "multi_choice", required=True, options=["A"])]
    assert "m" in errors_for(fields, {"m": []})


def test_optional_empty_is_dropped():
    assert validate_answers([field("o")], {"o": ""}) == {}
    assert validate_answers([field("o")], {}) == {}


def test_hidden_required_field_is_not_required():
    fields = [field("h", required=True, hidden=True)]
    assert validate_answers(fields, {}) == {}


def test_unknown_keys_rejected():
    assert errors_for([field("a")], {"a": "x", "zzz": "y"}) == {"zzz": "Unknown field."}


def test_all_errors_collected():
    fields = [field("a", required=True), field("b", "number")]
    errors = errors_for(fields, {"b": "x", "c": 1})
    assert set(errors) == {"a", "b", "c"}


def test_form_error_is_value_error():
    assert issubclass(FormError, ValueError)


def test_validate_answers_accepts_orm_like_fields():
    row = SimpleNamespace(
        key="size", label="Size", type="single_choice", required=True, options=["S"], hidden=False
    )
    assert validate_answers([row], {"size": "S"}) == {"size": "S"}


# --------------------------------------------------------------------------- R10 edits


def edit_error(old, new, answered=frozenset(), has_registrations=False):
    with pytest.raises(FormError) as exc:
        check_form_edit(old, new, set(answered), has_registrations=has_registrations)
    return exc.value


def test_edit_allowed_when_no_answers():
    old = [field("a", "short_text")]
    new = [field("a", "number", required=True)]
    assert check_form_edit(old, new, set()) is None


def test_answered_field_cannot_be_deleted():
    err = edit_error([field("a"), field("b")], [field("b")], {"a"})
    assert err.code == "field_locked"
    assert "Hide it" in err.message


def test_answered_field_can_be_hidden():
    assert check_form_edit([field("a")], [field("a", hidden=True)], {"a"}) is None


def test_answered_field_cannot_be_retyped():
    err = edit_error([field("a", "short_text")], [field("a", "long_text")], {"a"})
    assert err.code == "field_locked"


def test_answered_choice_cannot_lose_options():
    old = [field("c", "single_choice", options=["A", "B"])]
    new = [field("c", "single_choice", options=["A"])]
    err = edit_error(old, new, {"c"})
    assert err.code == "field_locked"
    assert "'B'" in err.message


def test_answered_choice_can_gain_options():
    old = [field("c", "multi_choice", options=["A", "B"])]
    new = [field("c", "multi_choice", options=["B", "A", "C"])]
    assert check_form_edit(old, new, {"c"}) is None


def test_unanswered_field_can_be_deleted_or_retyped():
    old = [field("a"), field("b")]
    new = [field("b", "number")]
    assert check_form_edit(old, new, set()) is None


def test_new_required_field_blocked_once_registrations_exist():
    err = edit_error([field("a")], [field("a"), field("b", required=True)], has_registrations=True)
    assert err.code == "required_field_blocked"
    assert "optional" in err.message


def test_existing_field_cannot_become_required_once_registrations_exist():
    err = edit_error([field("a")], [field("a", required=True)], has_registrations=True)
    assert err.code == "required_field_blocked"


def test_new_optional_field_allowed_with_registrations():
    assert (
        check_form_edit([field("a")], [field("a"), field("b")], set(), has_registrations=True)
        is None
    )


def test_existing_required_field_stays_ok_with_registrations():
    old = [field("a", required=True)]
    assert check_form_edit(old, old, {"a"}, has_registrations=True) is None


def test_new_required_field_ok_without_registrations():
    assert check_form_edit([], [field("a", required=True)], set(), has_registrations=False) is None


def test_duplicate_keys_rejected():
    err = edit_error([], [field("a"), field("a")])
    assert err.code == "duplicate_key"


@pytest.mark.parametrize("key", ["A", "1abc", "has-dash", "", "a" * 51, "_a"])
def test_bad_keys_rejected(key):
    bad = SimpleNamespace(
        key=key, label="x", type="short_text", required=False, options=[], hidden=False
    )
    err = edit_error([], [bad])
    assert err.code == "bad_key"


def test_fifty_char_key_ok():
    assert check_form_edit([], [field("a" * 50)], set()) is None


# --------------------------------------------------------------------------- snapshot


def test_profile_snapshot_from_mapping_has_fixed_order():
    now = datetime(2026, 10, 25, 9, 30, tzinfo=UTC)
    student = {
        "section": "A",
        "year": 3,
        "email": "x@y.z",
        "department": "CSE",
        "roll_no": "21CS001",
        "name": "Asha",
    }
    snap = profile_snapshot(student, now=now)
    assert list(snap) == ["name", "roll_no", "department", "year", "section", "captured_at"]
    assert snap["captured_at"] == "2026-10-25T09:30:00+00:00"
    assert "email" not in snap


def test_profile_snapshot_from_object():
    student = SimpleNamespace(name="Ravi", roll_no="R1", department="ECE", year=2, section="B")
    snap = profile_snapshot(student)
    assert snap["name"] == "Ravi"
    datetime.fromisoformat(snap["captured_at"])


def test_profile_snapshot_is_a_copy():
    student = {"name": "Asha", "roll_no": "1", "department": "CSE", "year": 3, "section": "A"}
    snap = profile_snapshot(student)
    student["department"] = "ECE"
    assert snap["department"] == "CSE"


# --------------------------------------------------------------------------- is_open

NOW = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)


def test_open_with_no_limits():
    assert is_open(False, None, None, 999, NOW) == (True, None)


def test_closed_by_club():
    assert is_open(True, None, None, 0, NOW) == (False, "closed_by_club")


def test_deadline_passed():
    assert is_open(False, NOW - timedelta(seconds=1), None, 0, NOW) == (False, "deadline_passed")
    assert is_open(False, NOW, None, 0, NOW) == (False, "deadline_passed")
    assert is_open(False, NOW + timedelta(hours=1), None, 0, NOW) == (True, None)


def test_full():
    assert is_open(False, None, 40, 40, NOW) == (False, "full")
    assert is_open(False, None, 40, 39, NOW) == (True, None)


def test_reason_precedence():
    assert is_open(True, NOW - timedelta(days=1), 1, 5, NOW) == (False, "closed_by_club")
    assert is_open(False, NOW - timedelta(days=1), 1, 5, NOW) == (False, "deadline_passed")


def test_naive_deadline_treated_as_utc():
    naive = datetime(2026, 10, 25, 11, 0)
    assert is_open(False, naive, None, 0, NOW) == (False, "deadline_passed")
