"""Pure P4 rules (no database): the attendee rule, the preview pick, Certificate values and
the batch status rollup. Plus job edge cases that need Postgres (skipped without it)."""

import random
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.certificates import jobs, service
from app.certificates.models import (
    CertificateBatchItem,
    CertificateBatchItemStatus,
    CertificateBatchStatus,
)
from app.registrations.models import RegistrationStatus
from tests.test_certificates_api import (  # noqa: F401 - fixtures
    API,
    attendees,
    make_batch,
    setup,
    storage,
    template,
)

# --- the attendee rule -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "present", "expected"),
    [
        (RegistrationStatus.CONFIRMED, None, True),  # no attendance row: ticked by default
        (RegistrationStatus.CONFIRMED, True, True),
        (RegistrationStatus.CONFIRMED, False, False),
        (RegistrationStatus.PENDING, None, False),
        (RegistrationStatus.CANCELLED, True, False),
        (RegistrationStatus.REJECTED, None, False),
    ],
)
def test_is_attendee(status, present, expected):
    assert service.is_attendee(status, present) is expected


# --- preview pick ----------------------------------------------------------------------------


def _ids(n):
    return [uuid.uuid4() for _ in range(n)]


def test_pick_preview_longest_shortest_random():
    a, b, c, d = _ids(4)
    candidates = [(a, "Mid Name"), (b, "Al"), (c, "A Very Long Student Name"), (d, "Other")]
    picked = service.pick_preview(candidates, random.Random(0))
    assert picked[0] == c  # longest
    assert picked[1] == b  # shortest
    assert len(picked) == len(set(picked)) <= 3


def test_pick_preview_dedupes():
    (a,) = _ids(1)
    assert service.pick_preview([(a, "Solo")]) == [a]
    a, b = _ids(2)
    assert set(service.pick_preview([(a, "Short"), (b, "Much longer")])) == {a, b}
    assert service.pick_preview([]) == []


# --- values ----------------------------------------------------------------------------------


def test_format_answer():
    assert service.format_answer(["AI", "Web"]) == "AI, Web"
    assert service.format_answer(True) == "Yes"
    assert service.format_answer(False) == "No"
    assert service.format_answer(None) == ""
    assert service.format_answer(42) == "42"


def test_event_date_uses_university_timezone():
    # 20:00 UTC on the 24th is the 25th in India.
    starts = datetime(2026, 10, 24, 20, 0, tzinfo=UTC)
    assert service.format_event_date(starts, "Asia/Kolkata") == "25 October 2026"
    assert service.format_event_date(starts, "UTC") == "24 October 2026"


def test_build_values_and_display():
    snap = {"name": "Asha", "roll_no": "21CS1", "department": "CSE", "year": 3, "section": "B"}
    values, display = service.build_values(
        snap,
        {"tracks": ["AI", "Web"], "veg": True},
        event_name="Hack Night",
        starts_at=datetime(2026, 10, 24, 20, 0, tzinfo=UTC),
        timezone="Asia/Kolkata",
        club_name="Code Club",
        public_id="ORG-AAAA-BBBB",
    )
    assert values["name"] == "Asha"
    assert values["year"] == "3"
    assert values["event_name"] == "Hack Night"
    assert values["event_date"] == "25 October 2026"
    assert values["club_name"] == "Code Club"
    assert values["certificate_id"] == "ORG-AAAA-BBBB"
    assert values["form.tracks"] == "AI, Web"
    assert values["form.veg"] == "Yes"
    assert display == {
        "name": "Asha",
        "event": "Hack Night",
        "club": "Code Club",
        "date": "2026-10-25",
    }


# --- batch rollup ----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("pending", "failed", "expected"),
    [
        (3, 0, CertificateBatchStatus.RUNNING),
        (1, 2, CertificateBatchStatus.RUNNING),
        (0, 0, CertificateBatchStatus.DONE),
        (0, 1, CertificateBatchStatus.DONE_WITH_FAILURES),
    ],
)
def test_rollup_status(pending, failed, expected):
    assert service.rollup_status(pending, failed) == expected


def test_storage_keys():
    eid = uuid.UUID(int=1)
    tid = uuid.UUID(int=2)
    assert service.template_key(eid, tid) == f"certificate-templates/{eid}/{tid}.pdf"
    assert service.certificate_key(eid, "ORG-AAAA-BBBB") == f"certificates/{eid}/ORG-AAAA-BBBB.pdf"


# --- job edge cases (Postgres) ---------------------------------------------------------------


def test_item_fails_when_no_longer_an_attendee(client, db, setup, template, attendees):  # noqa: F811
    _, _, event = setup
    batch_id = make_batch(client, event.id, template["id"]).json()["id"]
    gone = attendees[0]
    gone.status = RegistrationStatus.CANCELLED
    db.flush()
    item = db.scalar(
        select(CertificateBatchItem).where(
            CertificateBatchItem.batch_id == batch_id,
            CertificateBatchItem.registration_id == gone.id,
        )
    )
    assert jobs.do_generate_certificate(db, item.id) is None
    db.refresh(item)
    assert item.status == CertificateBatchItemStatus.FAILED
    assert item.error == jobs.NOT_ATTENDEE
    assert item.attempts == 1
    assert item.certificate_id is None


def test_unknown_item_is_a_noop(db):
    assert jobs.do_generate_certificate(db, uuid.uuid4()) is None
