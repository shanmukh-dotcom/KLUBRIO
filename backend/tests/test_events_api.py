"""API tests for events, Registration Forms and Eligibility Rules (P2). Need Postgres."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.events.models import FormField, FormFieldType
from app.events.service import form_for
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import add_coordinator, login, make_club, make_event, make_student

BASE = "/api/v1"


def iso(dt: datetime) -> str:
    return dt.isoformat()


def event_body(**overrides):
    start = datetime.now(UTC) + timedelta(days=7)
    body = {
        "name": "Hackathon",
        "description": "24 hours",
        "starts_at": iso(start),
        "ends_at": iso(start + timedelta(hours=24)),
        "venue": "Main Hall",
        "seat_limit": 40,
    }
    body.update(overrides)
    return body


def register(db, event, student, status=RegistrationStatus.CONFIRMED, answers=None):
    reg = Registration(
        event_id=event.id,
        student_id=student.id,
        profile_snapshot={"name": student.name},
        answers=answers or {},
        status=status,
    )
    db.add(reg)
    db.flush()
    return reg


def add_field(db, event, key, type_=FormFieldType.SHORT_TEXT, position=0, **kw):
    form = form_for(db, event.id)
    row = FormField(
        form_id=form.id, key=key, label=key.title(), type=type_, position=position, **kw
    )
    db.add(row)
    db.flush()
    return row


def setup(db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    return president, club, event


# --------------------------------------------------------------------------- create


def test_president_creates_event_with_empty_form(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    login(client, db, president)
    r = client.post(f"{BASE}/clubs/{club.id}/events", json=event_body())
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["club_id"] == str(club.id)
    assert data["is_open"] is True and data["closed_reason"] is None
    assert data["confirmed_count"] == 0 and data["pending_count"] == 0
    form = client.get(f"{BASE}/events/{data['id']}/form").json()
    assert form["fields"] == []
    assert form["profile_fields"] == ["name", "roll_no", "department", "year", "section"]


def test_coordinator_creates_event(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    coordinator = make_student(db)
    add_coordinator(db, club, coordinator)
    login(client, db, coordinator)
    assert client.post(f"{BASE}/clubs/{club.id}/events", json=event_body()).status_code == 201


def test_outsider_cannot_create(client, db):
    club = make_club(db, president=make_student(db))
    login(client, db, make_student(db))
    r = client.post(f"{BASE}/clubs/{club.id}/events", json=event_body())
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_coordinator_of_other_club_cannot_create(client, db):
    club = make_club(db, president=make_student(db))
    other = make_club(db, president=make_student(db))
    coordinator = make_student(db)
    add_coordinator(db, other, coordinator)
    login(client, db, coordinator)
    assert client.post(f"{BASE}/clubs/{club.id}/events", json=event_body()).status_code == 403


def test_create_requires_login(client, db):
    club = make_club(db, president=make_student(db))
    assert client.post(f"{BASE}/clubs/{club.id}/events", json=event_body()).status_code == 401


def test_create_validation(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    login(client, db, president)
    url = f"{BASE}/clubs/{club.id}/events"
    start = datetime.now(UTC) + timedelta(days=1)
    assert (
        client.post(url, json=event_body(ends_at=iso(start), starts_at=iso(start))).status_code
        == 422
    )
    assert client.post(url, json=event_body(seat_limit=0)).status_code == 422
    naive = event_body(registration_deadline="2026-11-01T10:00:00")
    assert client.post(url, json=naive).status_code == 422


def test_datetimes_returned_in_utc(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    login(client, db, president)
    body = event_body(starts_at="2030-01-01T10:00:00+05:30", ends_at="2030-01-01T12:00:00+05:30")
    data = client.post(f"{BASE}/clubs/{club.id}/events", json=body).json()
    assert datetime.fromisoformat(data["starts_at"]) == datetime(2030, 1, 1, 4, 30, tzinfo=UTC)


# --------------------------------------------------------------------------- get / patch


def test_get_event_counts(client, db):
    president, _, event = setup(db)
    register(db, event, make_student(db), RegistrationStatus.CONFIRMED)
    register(db, event, make_student(db), RegistrationStatus.CONFIRMED)
    register(db, event, make_student(db), RegistrationStatus.PENDING)
    register(db, event, make_student(db), RegistrationStatus.CANCELLED)
    login(client, db, president)
    data = client.get(f"{BASE}/events/{event.id}").json()
    assert data["confirmed_count"] == 2
    assert data["pending_count"] == 1


def test_get_event_outsider_forbidden_and_missing_404(client, db):
    _, _, event = setup(db)
    login(client, db, make_student(db))
    assert client.get(f"{BASE}/events/{event.id}").status_code == 403
    r = client.get(f"{BASE}/events/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "event_not_found"


def test_patch_event(client, db):
    president, _, event = setup(db)
    event.seat_limit = 10
    db.flush()
    login(client, db, president)
    r = client.patch(f"{BASE}/events/{event.id}", json={"venue": "Room 2", "seat_limit": None})
    assert r.status_code == 200, r.text
    assert r.json()["venue"] == "Room 2"
    assert r.json()["seat_limit"] is None
    assert r.json()["name"] == "Test Event"
    # ends_at before the existing starts_at is rejected.
    bad = iso(event.starts_at - timedelta(hours=1))
    assert client.patch(f"{BASE}/events/{event.id}", json={"ends_at": bad}).status_code == 422


def test_full_event_is_closed(client, db):
    president, _, event = setup(db)
    event.seat_limit = 1
    db.flush()
    register(db, event, make_student(db))
    login(client, db, president)
    data = client.get(f"{BASE}/events/{event.id}").json()
    assert (data["is_open"], data["closed_reason"]) == (False, "full")


# --------------------------------------------------------------------------- form


def put_form(client, event, fields):
    return client.put(f"{BASE}/events/{event.id}/form", json={"fields": fields})


def test_put_form_upserts_by_key(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    r = put_form(
        client,
        event,
        [
            {"key": "tshirt", "label": "T-shirt", "type": "single_choice", "options": ["S", "M"]},
            {"key": "github", "label": "GitHub", "type": "short_text", "required": True},
        ],
    )
    assert r.status_code == 200, r.text
    assert [f["key"] for f in r.json()["fields"]] == ["tshirt", "github"]
    tshirt_id = db.scalar(select(FormField.id).where(FormField.key == "tshirt"))

    r = put_form(
        client,
        event,
        [
            {"key": "github", "label": "GitHub handle", "type": "short_text"},
            {"key": "tshirt", "label": "Size", "type": "single_choice", "options": ["S", "M", "L"]},
        ],
    )
    assert r.status_code == 200, r.text
    fields = r.json()["fields"]
    assert [f["key"] for f in fields] == ["github", "tshirt"]
    assert fields[0]["label"] == "GitHub handle" and fields[0]["required"] is False
    same_id = db.scalar(select(FormField.id).where(FormField.key == "tshirt"))
    assert same_id == tshirt_id


def test_choice_field_needs_options(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    r = put_form(client, event, [{"key": "c", "label": "C", "type": "single_choice"}])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_options"


def test_duplicate_key_is_400(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    field = {"key": "a", "label": "A", "type": "short_text"}
    r = put_form(client, event, [field, field])
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "duplicate_key"


def test_optional_field_can_be_added_after_registrations(client, db):
    president, _, event = setup(db)
    add_field(db, event, "github")
    register(db, event, make_student(db), answers={"github": "asha"})
    login(client, db, president)
    r = put_form(
        client,
        event,
        [
            {"key": "github", "label": "GitHub", "type": "short_text"},
            {"key": "diet", "label": "Diet", "type": "short_text"},
        ],
    )
    assert r.status_code == 200, r.text


def test_required_field_blocked_after_registrations(client, db):
    president, _, event = setup(db)
    register(db, event, make_student(db))
    login(client, db, president)
    r = put_form(
        client, event, [{"key": "diet", "label": "Diet", "type": "short_text", "required": True}]
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "required_field_blocked"
    assert "diet" in r.json()["error"]["message"]


def test_answered_field_cannot_be_deleted_but_can_be_hidden(client, db):
    president, _, event = setup(db)
    add_field(db, event, "github")
    add_field(db, event, "unused", position=1)
    register(db, event, make_student(db), answers={"github": "asha"})
    login(client, db, president)

    r = put_form(client, event, [])
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "field_locked"

    r = put_form(client, event, [{"key": "github", "label": "GitHub", "type": "long_text"}])
    assert r.status_code == 409  # retype blocked

    # Hiding the answered field and deleting the unanswered one is fine.
    r = put_form(
        client, event, [{"key": "github", "label": "GitHub", "type": "short_text", "hidden": True}]
    )
    assert r.status_code == 200, r.text
    assert r.json()["fields"] == [
        {
            "key": "github",
            "label": "GitHub",
            "type": "short_text",
            "required": False,
            "help_text": "",
            "options": [],
            "hidden": True,
        }
    ]


def test_form_outsider_forbidden(client, db):
    _, _, event = setup(db)
    login(client, db, make_student(db))
    assert client.get(f"{BASE}/events/{event.id}/form").status_code == 403
    assert put_form(client, event, []).status_code == 403


# --------------------------------------------------------------------------- eligibility


def test_put_eligibility_replaces_rules(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    url = f"{BASE}/events/{event.id}/eligibility"
    rules = [
        {"field": "year", "values": ["3", "4"]},
        {"field": "department", "values": [" CSE ", "ECE"]},
    ]
    r = client.put(url, json={"rules": rules})
    assert r.status_code == 200, r.text
    assert r.json()["rules"][1]["values"] == ["CSE", "ECE"]

    r = client.put(url, json={"rules": [{"field": "section", "values": ["A"]}]})
    assert r.status_code == 200
    data = client.get(f"{BASE}/events/{event.id}").json()
    assert data["eligibility_rules"] == [{"field": "section", "operator": "in", "values": ["A"]}]


def test_eligibility_rejects_non_profile_fields_and_bad_years(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    url = f"{BASE}/events/{event.id}/eligibility"
    assert (
        client.put(url, json={"rules": [{"field": "tshirt", "values": ["M"]}]}).status_code == 422
    )
    r = client.put(url, json={"rules": [{"field": "year", "values": ["third"]}]})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_rule"


# --------------------------------------------------------------------------- close / reopen


def test_close_and_reopen(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    r = client.post(f"{BASE}/events/{event.id}/close")
    assert r.status_code == 200
    assert (r.json()["is_open"], r.json()["closed_reason"]) == (False, "closed_by_club")
    assert r.json()["manually_closed"] is True
    public = client.get(f"{BASE}/events/{event.id}/public").json()
    assert public["is_open"] is False
    r = client.post(f"{BASE}/events/{event.id}/reopen")
    assert (r.json()["is_open"], r.json()["manually_closed"]) == (True, False)


def test_close_outsider_forbidden(client, db):
    _, _, event = setup(db)
    login(client, db, make_student(db))
    assert client.post(f"{BASE}/events/{event.id}/close").status_code == 403


# --------------------------------------------------------------------------- public page


def test_public_page_anonymous(client, db):
    _, club, event = setup(db)
    event.seat_limit = 10
    db.flush()
    add_field(db, event, "github")
    add_field(db, event, "old", position=1, hidden=True)
    register(db, event, make_student(db))
    r = client.get(f"{BASE}/events/{event.id}/public")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["club_name"] == club.name
    assert data["is_open"] is True
    assert data["seats_left"] == 9
    assert [f["key"] for f in data["form"]["fields"]] == ["github"]
    assert data["am_i_eligible"] is None
    assert data["failed_rules"] is None
    assert data["my_registration_status"] is None
    assert "created_by" not in data


def test_public_page_logged_in_eligible_and_registered(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    client.put(
        f"{BASE}/events/{event.id}/eligibility",
        json={"rules": [{"field": "year", "values": ["3"]}]},
    )
    student = make_student(db, year=3)
    register(db, event, student, RegistrationStatus.PENDING)
    login(client, db, student)
    data = client.get(f"{BASE}/events/{event.id}/public").json()
    assert data["am_i_eligible"] is True
    assert data["failed_rules"] == []
    assert data["my_registration_status"] == "pending"


def test_public_page_logged_in_ineligible(client, db):
    president, _, event = setup(db)
    login(client, db, president)
    client.put(
        f"{BASE}/events/{event.id}/eligibility",
        json={"rules": [{"field": "department", "values": ["ECE"]}]},
    )
    student = make_student(db, department="CSE")
    login(client, db, student)
    data = client.get(f"{BASE}/events/{event.id}/public").json()
    assert data["am_i_eligible"] is False
    assert data["failed_rules"] == ["department must be one of: ECE"]
    assert data["my_registration_status"] is None


def test_public_page_deadline_passed(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(
        db, club, president, registration_deadline=datetime.now(UTC) - timedelta(minutes=1)
    )
    data = client.get(f"{BASE}/events/{event.id}/public").json()
    assert (data["is_open"], data["closed_reason"]) == (False, "deadline_passed")


def test_public_page_missing_event(client, db):
    r = client.get(f"{BASE}/events/00000000-0000-0000-0000-000000000000/public")
    assert r.status_code == 404
