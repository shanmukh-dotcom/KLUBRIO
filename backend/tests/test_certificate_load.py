"""R35 load: 500 Certificates per batch.

`test_render_500_pure` needs no database and must finish within 60 s. `test_batch_500_db`
runs the real batch path (rows, job core, storage) and skips without Postgres.
"""

import io
import time

from sqlalchemy import select

from app.certificates import jobs, service
from app.certificates.models import (
    Certificate,
    CertificateBatch,
    CertificateBatchItem,
    CertificateBatchStatus,
    CertificateStatus,
)
from app.certificates.render import PlaceholderSpec, render_certificate
from app.certificates.tags import validate_template
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import make_club, make_event, make_student
from tests.test_certificates_api import default_template, storage  # noqa: F401 - fixture

N = 500
LIMIT_SECONDS = 60


def test_render_500_pure():
    pdf = default_template()
    scan = validate_template(pdf, set())
    specs = [
        PlaceholderSpec(t.tag, t.page, *t.placeholder_box(), t.font_name, t.font_size, t.align)
        for t in scan.tags
    ]
    started = time.perf_counter()
    for i in range(N):
        public_id = f"ORG-{i:04d}-TEST"
        out = render_certificate(
            pdf,
            specs,
            {"name": f"Student Number {i}", "event_name": "Hack Night"},
            public_id,
            f"http://localhost:3000/verify/{public_id}",
        )
        assert out.startswith(b"%PDF")
    elapsed = time.perf_counter() - started
    print(f"\n{N} pure renders in {elapsed:.2f}s ({elapsed / N * 1000:.1f} ms each)")
    assert elapsed < LIMIT_SECONDS


def test_batch_500_db(db, storage):  # noqa: F811
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Load Test")

    out = service.upload_template(db, president, event.id, io.BytesIO(default_template()))

    for i in range(N):
        student = make_student(db, name=f"Load Student {i}")
        db.add(
            Registration(
                event_id=event.id,
                student_id=student.id,
                profile_snapshot={"name": student.name, "roll_no": student.roll_no},
                answers={},
                status=RegistrationStatus.CONFIRMED,
            )
        )
    db.flush()

    batch = service.create_batch(db, president, event.id, out.id, "Subject", "Body")
    assert batch.total == N

    items = db.scalars(
        select(CertificateBatchItem.id).where(CertificateBatchItem.batch_id == batch.id)
    ).all()
    started = time.perf_counter()
    for item_id in items:
        jobs.do_generate_certificate(db, item_id)
    elapsed = time.perf_counter() - started
    print(f"\n{N} batch items generated with DB in {elapsed:.2f}s")

    certs = db.scalars(select(Certificate).where(Certificate.event_id == event.id)).all()
    assert len(certs) == N
    assert all(c.status == CertificateStatus.VALID for c in certs)
    assert len({c.public_id for c in certs}) == N
    assert db.get(CertificateBatch, batch.id).status == CertificateBatchStatus.DONE
