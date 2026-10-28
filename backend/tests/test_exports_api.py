"""Exports API (P6): R23-R26, engineering rule 6. DB tests skip without Postgres."""

import csv
import io
from datetime import UTC, datetime, timedelta

import pytest
from openpyxl import load_workbook
from sqlalchemy import func, select
from sqlalchemy.dialects import postgresql

from app.certificates.models import Attendance, Certificate, CertificateStatus
from app.events.models import FormField, FormFieldType, RegistrationForm
from app.exports.models import Export, ExportFilter
from app.exports.service import CONTENT_TYPES, filter_conditions
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import add_coordinator, login, make_club, make_event, make_student

URL = "/api/v1/events/{}/export"


# --- pure ---------------------------------------------------------------------------


def _sql(conditions) -> str:
    return " AND ".join(
        str(c.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        for c in conditions
    )


def test_filter_all_has_no_conditions():
    assert filter_conditions(ExportFilter.ALL) == []


def test_filter_confirmed_checks_status_only():
    sql = _sql(filter_conditions(ExportFilter.CONFIRMED))
    assert "registrations.status = 'confirmed'" in sql
    assert "attendance" not in sql


def test_filter_attendees_needs_confirmed_and_present():
    sql = _sql(filter_conditions(ExportFilter.ATTENDEES))
    assert "registrations.status = 'confirmed'" in sql
    assert "attendance.present IS true" in sql


def test_content_types():
    assert CONTENT_TYPES["csv"] == "text/csv; charset=utf-8"
    assert CONTENT_TYPES["xlsx"].endswith("spreadsheetml.sheet")


# --- DB-backed ----------------------------------------------------------------------


def _register(db, event, student, status, answers, present, minutes):
    reg = Registration(
        event_id=event.id,
        student_id=student.id,
        profile_snapshot={
            "name": student.name,
            "roll_no": student.roll_no,
            "department": student.department,
            "year": student.year,
            "section": student.section,
        },
        answers=answers,
        status=status,
        submitted_at=datetime.now(UTC) - timedelta(minutes=minutes),
    )
    db.add(reg)
    db.flush()
    if present is not None:
        db.add(Attendance(registration_id=reg.id, present=present))
        db.flush()
    return reg


@pytest.fixture
def setup(db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Tech Fest 2026")
    form = db.scalar(select(RegistrationForm).where(RegistrationForm.event_id == event.id))
    db.add_all(
        [
            FormField(
                form_id=form.id,
                key="team",
                label="Team",
                type=FormFieldType.SHORT_TEXT,
                position=0,
            ),
            FormField(
                form_id=form.id,
                key="notes",
                label="Internal notes",
                type=FormFieldType.LONG_TEXT,
                position=1,
                hidden=True,
            ),
        ]
    )
    db.flush()

    present = _register(
        db,
        event,
        make_student(db),
        RegistrationStatus.CONFIRMED,
        {"team": "=SUM(A1)", "notes": "vip"},
        True,
        30,
    )
    _register(
        db, event, make_student(db), RegistrationStatus.CONFIRMED, {"team": "Beta"}, False, 20
    )
    _register(
        db, event, make_student(db), RegistrationStatus.CANCELLED, {"team": "Gamma"}, None, 10
    )

    # An older revoked Certificate and a newer valid one: the valid one is exported.
    common = dict(
        event_id=event.id,
        student_id=present.student_id,
        registration_id=present.id,
        pdf_file_key="certs/x.pdf",
        display={"name": "x"},
    )
    db.add(
        Certificate(
            public_id="ORG-OLD0-0001",
            status=CertificateStatus.SUPERSEDED,
            issued_at=datetime.now(UTC) - timedelta(days=1),
            **common,
        )
    )
    db.add(Certificate(public_id="ORG-AB12-CD34", status=CertificateStatus.VALID, **common))
    db.flush()
    return {"president": president, "club": club, "event": event}


def _csv_rows(response):
    text = response.content.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def _export_count(db, event):
    return db.scalar(select(func.count()).select_from(Export).where(Export.event_id == event.id))


@pytest.mark.parametrize(("flt", "expected"), [("all", 3), ("confirmed", 2), ("attendees", 1)])
def test_csv_filters(client, db, setup, flt, expected):
    login(client, db, setup["president"])
    r = client.get(URL.format(setup["event"].id), params={"format": "csv", "filter": flt})
    assert r.status_code == 200
    assert r.headers["content-type"] == "text/csv; charset=utf-8"
    assert r.headers["cache-control"] == "no-store"
    disposition = r.headers["content-disposition"]
    assert disposition.startswith('attachment; filename="tech-fest-2026_registrations_')
    assert disposition.endswith('.csv"')
    assert len(_csv_rows(r)) == expected


@pytest.mark.parametrize(("flt", "expected"), [("all", 3), ("confirmed", 2), ("attendees", 1)])
def test_xlsx_filters(client, db, setup, flt, expected):
    login(client, db, setup["president"])
    r = client.get(URL.format(setup["event"].id), params={"format": "xlsx", "filter": flt})
    assert r.status_code == 200
    assert r.headers["content-type"] == CONTENT_TYPES["xlsx"]
    assert r.headers["content-disposition"].endswith('.xlsx"')
    ws = load_workbook(io.BytesIO(r.content), read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    assert len(rows) - 1 == expected
    assert "Internal notes (hidden)" in rows[0]


def test_csv_columns_escaping_and_certificate(client, db, setup):
    login(client, db, setup["president"])
    r = client.get(URL.format(setup["event"].id), params={"format": "csv", "filter": "attendees"})
    (row,) = _csv_rows(r)
    assert "Internal notes (hidden)" in row
    assert row["Internal notes (hidden)"] == "vip"
    assert row["Team"] == "'=SUM(A1)"
    assert row["Certificate ID"] == "ORG-AB12-CD34"
    assert row["Certificate Status"] == "valid"
    assert row["Attended"] == "Yes"
    assert row["Status"] == "confirmed"
    assert row["Email"].endswith("@example.com")


def test_default_filter_is_confirmed(client, db, setup):
    login(client, db, setup["president"])
    r = client.get(URL.format(setup["event"].id))
    assert r.status_code == 200
    assert len(_csv_rows(r)) == 2


def test_every_export_is_logged_once(client, db, setup):
    login(client, db, setup["president"])
    event = setup["event"]
    assert _export_count(db, event) == 0
    client.get(URL.format(event.id), params={"format": "xlsx", "filter": "attendees"})
    assert _export_count(db, event) == 1
    log = db.scalar(select(Export).where(Export.event_id == event.id))
    assert log.requested_by == setup["president"].id
    assert log.format == "xlsx"
    assert log.filter == "attendees"
    client.get(URL.format(event.id), params={"format": "csv"})
    assert _export_count(db, event) == 2


def test_coordinator_can_export(client, db, setup):
    coordinator = make_student(db)
    add_coordinator(db, setup["club"], coordinator)
    login(client, db, coordinator)
    assert client.get(URL.format(setup["event"].id)).status_code == 200


def test_outsider_forbidden(client, db, setup):
    login(client, db, make_student(db))
    r = client.get(URL.format(setup["event"].id))
    assert r.status_code == 403
    assert _export_count(db, setup["event"]) == 0


def test_coordinator_of_other_club_forbidden(client, db, setup):
    other = make_student(db)
    add_coordinator(db, make_club(db), other)
    login(client, db, other)
    assert client.get(URL.format(setup["event"].id)).status_code == 403


def test_platform_admin_can_export(client, db, setup):
    login(client, db, make_student(db, is_platform_admin=True))
    r = client.get(URL.format(setup["event"].id), params={"filter": "all"})
    assert r.status_code == 200
    assert len(_csv_rows(r)) == 3


def test_not_logged_in(client, db, setup):
    assert client.get(URL.format(setup["event"].id)).status_code == 401


def test_bad_format_422(client, db, setup):
    login(client, db, setup["president"])
    r = client.get(URL.format(setup["event"].id), params={"format": "pdf"})
    assert r.status_code == 422
    assert _export_count(db, setup["event"]) == 0


def test_unknown_event_404(client, db, setup):
    login(client, db, make_student(db, is_platform_admin=True))
    r = client.get(URL.format("00000000-0000-0000-0000-000000000000"))
    assert r.status_code == 404
