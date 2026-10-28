"""Regression tests for bugs the Phase 7a end-to-end run found against a real RQ queue.

The rest of the suite replaces `enqueue`, so these pin the parts that only broke for real.
"""

import io
import uuid

import pytest
from PIL import Image
from rq.job import validate_job_id as rq_validate_job_id

from app.certificates.models import (
    CertificateBatch,
    CertificateBatchItem,
    CertificateBatchItemStatus,
)
from app.jobs import queue
from app.jobs.queue import enqueue as ORIGINAL_ENQUEUE
from app.jobs.queue import validate_job_id
from app.posters.models import Poster, PosterRenderStatus
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import login, make_club, make_event, make_student


@pytest.mark.parametrize(
    "job_id",
    [
        f"render_poster-{uuid.uuid4()}",
        f"cert-{uuid.uuid4()}",
        f"cert-{uuid.uuid4()}-3",
        f"notify-{uuid.uuid4()}",
    ],
)
def test_job_ids_the_app_builds_are_accepted_by_rq(job_id):
    validate_job_id(job_id)
    rq_validate_job_id(job_id)  # RQ's own check, the one that raised in the e2e run


@pytest.mark.parametrize("job_id", ["cert:abc", "a b", "x/y", ""])
def test_bad_job_ids_are_rejected_before_redis(job_id):
    with pytest.raises(ValueError):
        validate_job_id(job_id)


def test_enqueue_rejects_bad_job_id_without_touching_redis(monkeypatch):
    import app.jobs.queue as real_queue

    def boom(*args, **kwargs):
        raise AssertionError("Redis must not be reached")

    monkeypatch.setattr(real_queue, "get_queue", boom)
    # Imported at module load, before the autouse fixture replaced `queue.enqueue`.
    with pytest.raises(ValueError):
        ORIGINAL_ENQUEUE(print, job_id="cert:1")


def _poster_with_area(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    login(client, db, president)
    buf = io.BytesIO()
    Image.new("RGB", (1200, 1800), "white").save(buf, "PNG")
    up = client.post(
        f"/api/v1/events/{event.id}/posters",
        files={"file": ("p.png", buf.getvalue(), "image/png")},
    )
    assert up.status_code == 201, up.text
    poster_id = up.json()["id"]
    area = client.put(
        f"/api/v1/posters/{poster_id}/qr-area", json={"x": 100, "y": 100, "w": 400, "h": 400}
    )
    assert area.status_code == 200, area.text
    return poster_id


def test_render_keeps_previous_status_when_enqueue_fails(client, db, monkeypatch):
    poster_id = _poster_with_area(client, db)

    def broken(*args, **kwargs):
        raise RuntimeError("queue exploded")

    monkeypatch.setattr(queue, "enqueue", broken)
    with pytest.raises(RuntimeError):
        client.post(f"/api/v1/posters/{poster_id}/render")
    poster = db.get(Poster, uuid.UUID(poster_id))
    db.refresh(poster)
    assert poster.render_status == PosterRenderStatus.NONE


def test_batch_items_that_could_not_be_queued_are_marked_failed(client, db, monkeypatch):
    from tests.test_certificates_api import default_template  # shared helper

    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    for _ in range(3):
        s = make_student(db)
        db.add(
            Registration(
                event_id=event.id,
                student_id=s.id,
                profile_snapshot={
                    "name": s.name,
                    "roll_no": s.roll_no,
                    "department": "CSE",
                    "year": 3,
                    "section": "A",
                    "captured_at": "2026-10-25T00:00:00Z",
                },
                answers={},
                status=RegistrationStatus.CONFIRMED,
            )
        )
    db.flush()
    login(client, db, president)
    up = client.post(
        f"/api/v1/events/{event.id}/certificate-templates",
        files={"file": ("t.pdf", default_template(), "application/pdf")},
    )
    assert up.status_code == 201, up.text

    calls = []

    def flaky(func, *args, job_id=None):
        validate_job_id(job_id)
        if calls:
            raise RuntimeError("queue went away")
        calls.append(job_id)

    monkeypatch.setattr(queue, "enqueue", flaky)
    with pytest.raises(RuntimeError):
        client.post(
            f"/api/v1/events/{event.id}/certificate-batches",
            json={"template_id": up.json()["id"], "message_subject": "s", "message_body": "b"},
        )
    items = list(
        db.query(CertificateBatchItem)
        .join(CertificateBatch, CertificateBatch.id == CertificateBatchItem.batch_id)
        .filter(CertificateBatch.event_id == event.id)
    )
    statuses = sorted(i.status.value for i in items)
    assert statuses == ["failed", "failed", "pending"]
    assert all(
        "Could not be queued" in i.error
        for i in items
        if i.status == CertificateBatchItemStatus.FAILED
    )


def test_attendees_export_counts_registrations_with_no_attendance_row(client, db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    for _ in range(4):
        s = make_student(db)
        db.add(
            Registration(
                event_id=event.id,
                student_id=s.id,
                profile_snapshot={
                    "name": s.name,
                    "roll_no": s.roll_no,
                    "department": "CSE",
                    "year": 3,
                    "section": "A",
                    "captured_at": "2026-10-25T00:00:00Z",
                },
                answers={},
                status=RegistrationStatus.CONFIRMED,
            )
        )
    db.flush()
    login(client, db, president)
    res = client.get(f"/api/v1/events/{event.id}/export?format=csv&filter=attendees")
    assert res.status_code == 200, res.text
    lines = res.content.decode("utf-8-sig").strip().splitlines()
    assert len(lines) == 1 + 4
    header = lines[0].split(",")
    attended = header.index(next(h for h in header if h.lower().startswith("attend")))
    assert all(line.split(",")[attended] == "Yes" for line in lines[1:])


def test_each_job_module_works_in_a_fresh_worker_process():
    """A worker imports only the job it runs. Every job module must still see every model,
    or flushing a row with a foreign key to an unimported table fails (found in the e2e run)."""
    import subprocess
    import sys

    for module in ("app.posters.jobs", "app.certificates.jobs", "app.notifications.jobs"):
        code = (
            f"import {module}\n"
            "from sqlalchemy.orm import configure_mappers\n"
            "from app.core.db import Base\n"
            "configure_mappers()\n"
            "for t in Base.metadata.sorted_tables:\n"
            "    [fk.column for fk in t.foreign_keys]\n"
        )
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        assert result.returncode == 0, f"{module}: {result.stderr[-500:]}"


class _CountingRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, seconds):
        pass


def test_event_page_limit_is_separate_from_verify_and_counted_per_event(monkeypatch):
    """Load test finding: at 60/min per IP, a campus sharing one IP got 429s on the Event page."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.core import ratelimit
    from app.core.errors import register_error_handlers
    from app.core.settings import get_settings

    fake = _CountingRedis()
    monkeypatch.setattr(ratelimit, "get_ratelimit_redis", lambda: fake)
    app = FastAPI()
    register_error_handlers(app)

    from fastapi import Depends

    @app.get("/events/{event_id}/public", dependencies=[Depends(ratelimit.event_page_rate_limit)])
    def page(event_id: str):
        return {}

    @app.get("/verify/{public_id}", dependencies=[Depends(ratelimit.public_rate_limit)])
    def verify(public_id: str):
        return {}

    client = TestClient(app)
    settings = get_settings()
    assert settings.rate_limit_event_page_per_minute > 2000  # N1: 2,000 scans a minute
    for _ in range(200):
        assert client.get("/events/a/public").status_code == 200
    statuses = [client.get("/verify/x").status_code for _ in range(70)]
    assert statuses.count(429) == 70 - settings.rate_limit_public_per_minute
    assert any(k.startswith("ratelimit:event_page:a:") for k in fake.counts)
    client.get("/events/b/public")
    assert any(k.startswith("ratelimit:event_page:b:") for k in fake.counts)


def test_db_pool_comes_from_settings():
    from app.core.db import get_engine
    from app.core.settings import get_settings

    pool = get_engine().pool
    assert pool.size() == get_settings().db_pool_size
