"""Registrations (P2): R12-R18, decision 27, domain rules 5-7.

The transition-table tests are pure; the API tests need PostgreSQL and skip without it.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.events.models import EligibilityRule, FormField, RegistrationForm
from app.registrations import service
from app.registrations.models import Registration
from app.registrations.models import RegistrationStatus as S
from tests.factories import login, make_club, make_event, make_student

# --------------------------------------------------------------------------- pure


def test_transition_table_matches_design():
    assert {
        S.PENDING: {S.CONFIRMED, S.REJECTED, S.CANCELLED},
        S.CONFIRMED: {S.CANCELLED},
        S.CANCELLED: {S.PENDING, S.CONFIRMED},
        S.REJECTED: set(),
    } == service.TRANSITIONS


def test_transition_table_covers_every_status():
    assert set(service.TRANSITIONS) == set(S)


@pytest.mark.parametrize(
    ("old", "new", "ok"),
    [
        (S.PENDING, S.CONFIRMED, True),
        (S.PENDING, S.REJECTED, True),
        (S.PENDING, S.CANCELLED, True),
        (S.CONFIRMED, S.CANCELLED, True),
        (S.CANCELLED, S.CONFIRMED, True),
        (S.CANCELLED, S.PENDING, True),
        (S.CONFIRMED, S.PENDING, False),
        (S.CONFIRMED, S.REJECTED, False),
        (S.REJECTED, S.PENDING, False),
        (S.REJECTED, S.CONFIRMED, False),
        (S.CANCELLED, S.REJECTED, False),
    ],
)
def test_can_transition(old, new, ok):
    assert service.can_transition(old, new) is ok


def test_actor_transitions_are_within_the_table():
    for old, new in service.STUDENT_TRANSITIONS | service.CLUB_TRANSITIONS:
        assert service.can_transition(old, new)


def test_initial_status():
    assert service.initial_status(False) == S.CONFIRMED
    assert service.initial_status(True) == S.PENDING


# --------------------------------------------------------------------------- helpers


def _setup(db, **event_overrides):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, **event_overrides)
    return president, club, event


def _add_field(db, event, key="tshirt", **kw):
    form = db.scalar(select(RegistrationForm).where(RegistrationForm.event_id == event.id))
    values = dict(form_id=form.id, key=key, label=key.title(), type="short_text", position=0)
    values.update(kw)
    field = FormField(**values)
    db.add(field)
    db.flush()
    return field


def _url(event):
    return f"/api/v1/events/{event.id}/registrations"


def _register(client, db, student, event, answers=None):
    login(client, db, student)
    return client.post(_url(event), json={"answers": answers or {}})


def _count(db, event, student=None):
    query = select(func.count()).select_from(Registration).where(Registration.event_id == event.id)
    if student is not None:
        query = query.where(Registration.student_id == student.id)
    return db.scalar(query)


# --------------------------------------------------------------------------- register


def test_register_confirmed_when_approval_off(client, db):
    _, _, event = _setup(db)
    _add_field(db, event, required=True)
    student = make_student(db)
    r = _register(client, db, student, event, {"tshirt": "  M "})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "confirmed"
    assert body["answers"] == {"tshirt": "M"}
    assert body["student_id"] == str(student.id)
    assert body["profile_snapshot"]["roll_no"] == student.roll_no
    assert body["decided_at"] is None


def test_register_requires_login(client, db):
    _, _, event = _setup(db)
    r = client.post(_url(event), json={"answers": {}})
    assert r.status_code == 401


def test_register_unknown_event_404(client, db):
    login(client, db, make_student(db))
    r = client.post(f"/api/v1/events/{uuid.uuid4()}/registrations", json={"answers": {}})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "event_not_found"


def test_pending_then_approve_and_reject(client, db):
    president, _, event = _setup(db, approval_required=True)
    alice, bob = make_student(db), make_student(db)

    a = _register(client, db, alice, event).json()
    b = _register(client, db, bob, event).json()
    assert a["status"] == b["status"] == "pending"

    login(client, db, president)
    r = client.post(f"/api/v1/registrations/{a['id']}/approve")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"
    assert r.json()["decided_by"] == str(president.id)
    assert r.json()["decided_at"] is not None

    r = client.post(f"/api/v1/registrations/{b['id']}/reject")
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
    assert r.json()["decided_by"] == str(president.id)

    # Neither can be decided again.
    for rid in (a["id"], b["id"]):
        for action in ("approve", "reject"):
            r = client.post(f"/api/v1/registrations/{rid}/{action}")
            assert r.status_code == 409
            assert r.json()["error"]["code"] == "invalid_transition"

    # A rejected Student can't re-apply.
    r = _register(client, db, bob, event)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "registration_rejected"


def test_approve_by_outsider_forbidden(client, db):
    _, _, event = _setup(db, approval_required=True)
    reg = _register(client, db, make_student(db), event).json()
    login(client, db, make_student(db))
    r = client.post(f"/api/v1/registrations/{reg['id']}/approve")
    assert r.status_code == 403
    r = client.post(f"/api/v1/registrations/{reg['id']}/reject")
    assert r.status_code == 403


def test_approve_unknown_registration_404(client, db):
    login(client, db, make_student(db))
    r = client.post(f"/api/v1/registrations/{uuid.uuid4()}/approve")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "registration_not_found"


def test_ineligible_403(client, db):
    _, _, event = _setup(db)
    db.add(EligibilityRule(event_id=event.id, field="year", values=[1, 2]))
    db.add(EligibilityRule(event_id=event.id, field="department", values=["cse"]))
    db.flush()
    student = make_student(db, year=3, department="CSE")
    r = _register(client, db, student, event)
    assert r.status_code == 403
    err = r.json()["error"]
    assert err["code"] == "not_eligible"
    assert "year must be one of: 1, 2" in err["message"]
    assert "department must be" not in err["message"]
    assert _count(db, event) == 0


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"manually_closed": True}, "closed registration"),
        ({"registration_deadline": datetime.now(UTC) - timedelta(minutes=1)}, "deadline"),
    ],
)
def test_closed_409(client, db, overrides, reason):
    _, _, event = _setup(db, **overrides)
    r = _register(client, db, make_student(db), event)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "registration_closed"
    assert reason in r.json()["error"]["message"].lower()


def test_full_409(client, db):
    _, _, event = _setup(db, seat_limit=1)
    assert _register(client, db, make_student(db), event).status_code == 201
    r = _register(client, db, make_student(db), event)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "registration_closed"
    assert "seat" in r.json()["error"]["message"]


def test_invalid_answers_422(client, db):
    _, _, event = _setup(db)
    _add_field(db, event, key="tshirt", required=True)
    _add_field(db, event, key="age", type="number", position=1)
    r = _register(client, db, make_student(db), event, {"age": "old", "bogus": 1})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "invalid_answers"
    for key in ("tshirt", "age", "bogus"):
        assert key in err["message"]
    assert _count(db, event) == 0


def test_double_register_409(client, db):
    _, _, event = _setup(db)
    student = make_student(db)
    assert _register(client, db, student, event).status_code == 201
    r = _register(client, db, student, event)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "already_registered"
    assert _count(db, event, student) == 1


# --------------------------------------------------------------------------- cancel


def test_cancel_then_reregister_reuses_row(client, db):
    _, _, event = _setup(db, seat_limit=1)
    _add_field(db, event)
    student = make_student(db, section="A")
    first = _register(client, db, student, event, {"tshirt": "M"}).json()

    assert client.delete(f"{_url(event)}/me").status_code == 204
    reg = db.get(Registration, uuid.UUID(first["id"]))
    db.refresh(reg)
    assert reg.status == S.CANCELLED

    # Cancelling freed the seat; someone takes it and cancels again.
    other = make_student(db)
    assert _register(client, db, other, event).json()["status"] == "confirmed"
    assert client.delete(f"{_url(event)}/me").status_code == 204

    student.section = "B"
    db.flush()
    second = _register(client, db, student, event, {"tshirt": "L"}).json()
    assert second["id"] == first["id"]
    assert second["status"] == "confirmed"
    assert second["answers"] == {"tshirt": "L"}
    assert second["profile_snapshot"]["section"] == "B"
    assert second["profile_snapshot"]["captured_at"] != first["profile_snapshot"]["captured_at"]
    assert _count(db, event, student) == 1


def test_reregister_clears_decision(client, db):
    president, _, event = _setup(db, approval_required=True)
    student = make_student(db)
    reg = _register(client, db, student, event).json()
    login(client, db, president)
    assert client.post(f"/api/v1/registrations/{reg['id']}/approve").status_code == 200
    login(client, db, student)
    assert client.delete(f"{_url(event)}/me").status_code == 204
    again = client.post(_url(event), json={"answers": {}}).json()
    assert again["id"] == reg["id"]
    assert again["status"] == "pending"
    assert again["decided_at"] is None
    assert again["decided_by"] is None


def test_cancel_when_closed_409(client, db):
    _, _, event = _setup(db)
    _register(client, db, make_student(db), event)
    event.manually_closed = True
    db.flush()
    r = client.delete(f"{_url(event)}/me")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "registration_closed"


def test_cancel_allowed_when_full(client, db):
    _, _, event = _setup(db, seat_limit=1)
    _register(client, db, make_student(db), event)
    assert client.delete(f"{_url(event)}/me").status_code == 204


def test_cancel_without_registration_404(client, db):
    _, _, event = _setup(db)
    login(client, db, make_student(db))
    r = client.delete(f"{_url(event)}/me")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "registration_not_found"


# --------------------------------------------------------------------------- snapshot


def test_profile_snapshot_unchanged_after_profile_edit(client, db):
    _, _, event = _setup(db)
    student = make_student(db, department="CSE", name="Asha")
    reg_id = _register(client, db, student, event).json()["id"]

    student.department = "ECE"
    student.name = "Asha K"
    db.flush()

    reg = db.get(Registration, uuid.UUID(reg_id))
    db.refresh(reg)
    assert reg.profile_snapshot["department"] == "CSE"
    assert reg.profile_snapshot["name"] == "Asha"
    # jsonb sorts keys, so compare the set: key order is not stored by Postgres.
    assert set(reg.profile_snapshot) == {
        "name",
        "roll_no",
        "department",
        "year",
        "section",
        "captured_at",
    }


# --------------------------------------------------------------------------- list


def test_list_is_club_only(client, db):
    president, _, event = _setup(db, approval_required=True)
    _register(client, db, make_student(db), event)
    r2 = _register(client, db, make_student(db), event).json()

    login(client, db, make_student(db))
    r = client.get(_url(event))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"

    login(client, db, president)
    assert client.post(f"/api/v1/registrations/{r2['id']}/approve").status_code == 200
    r = client.get(_url(event))
    assert r.status_code == 200
    assert len(r.json()) == 2

    r = client.get(_url(event), params={"status": "confirmed"})
    assert [x["id"] for x in r.json()] == [r2["id"]]

    r = client.get(_url(event), params={"limit": 1, "offset": 1})
    assert len(r.json()) == 1


def test_my_registration_helper(client, db):
    _, _, event = _setup(db)
    student = make_student(db)
    assert service.my_registration(db, event.id, student.id) is None
    _register(client, db, student, event)
    reg = service.my_registration(db, event.id, student.id)
    assert reg is not None
    assert reg.status == S.CONFIRMED


# --------------------------------------------------------------------------- full approve


def test_approve_when_full_event_full(client, db):
    president, _, event = _setup(db, approval_required=True, seat_limit=1)
    a = _register(client, db, make_student(db), event).json()
    b = _register(client, db, make_student(db), event).json()
    login(client, db, president)
    assert client.post(f"/api/v1/registrations/{a['id']}/approve").status_code == 200
    r = client.post(f"/api/v1/registrations/{b['id']}/approve")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "event_full"
    reg = db.get(Registration, uuid.UUID(b["id"]))
    db.refresh(reg)
    assert reg.status == S.PENDING
