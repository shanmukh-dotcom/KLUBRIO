"""Attendance and Certificate logic (P4): R27–R35, R40–R42; decisions 10, 11, 13, 26, 33, 35;
ADR 0001.

Routers stay thin and call these. PDF work comes from the pure modules `tags.py` and
`render.py`. Batch generation runs in the `generate_certificate` job (`jobs.py`), never in a
request. Writes only P4's tables: attendance, certificate_templates, placeholders,
certificate_batches, certificate_batch_items, certificates. Certificates are only ever
inserted, then change `status` (and `superseded_by` / `revoked_*`); nothing else (ADR 0001).

The pure helpers at the top (attendee rule, preview selection, value formatting, batch
rollup) have no database or storage and are unit-tested on their own.
"""

import io
import logging
import random
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any, BinaryIO
from zoneinfo import ZoneInfo

from fastapi import status
from pypdf import PdfReader, PdfWriter
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import Club, Student, University
from app.certificates import render
from app.certificates.ids import new_certificate_id
from app.certificates.models import (
    Attendance,
    Certificate,
    CertificateBatch,
    CertificateBatchItem,
    CertificateBatchItemStatus,
    CertificateBatchStatus,
    CertificateTemplate,
    PlaceholderAlign,
    PlaceholderSource,
)
from app.certificates.models import CertificateStatus as CertStatus
from app.certificates.models import Placeholder as PlaceholderRow
from app.certificates.schemas import (
    AttendanceEntry,
    CertificateBatchOut,
    CertificateOut,
    CertificateTemplateOut,
)
from app.certificates.schemas import Placeholder as PlaceholderIn
from app.certificates.tags import (
    PROFILE_TAGS,
    TemplateError,
    is_valid_tag,
    suggest_tag,
    validate_template,
)
from app.core.errors import AppError
from app.core.permissions import require_event_club_member
from app.core.settings import get_settings
from app.core.storage import StorageNotFound, get_storage
from app.events.models import Event, FormField, RegistrationForm
from app.jobs import queue
from app.registrations.models import Registration, RegistrationStatus

logger = logging.getLogger(__name__)

_CHUNK = 1024 * 1024
DEFAULT_TIMEZONE = "Asia/Kolkata"
PUBLIC_ID_ATTEMPTS = 5

# Values used by the preview when the Event has no Attendees yet (R33).
SAMPLE_VALUES: dict[str, str] = {
    "name": "Aarav Venkataraman Subramanian",
    "roll_no": "21CS1001",
    "department": "Computer Science",
    "year": "3",
    "section": "A",
}


# --- pure helpers ------------------------------------------------------------------------


def is_attendee(registration_status: str, present: bool | None) -> bool:
    """An Attendee is a Confirmed Registration that is present, or has no attendance row
    (`present is None`): everyone is ticked by default (R27, R28)."""
    return registration_status == RegistrationStatus.CONFIRMED and present is not False


def pick_preview(
    candidates: Sequence[tuple[uuid.UUID, str]], rng: random.Random | None = None
) -> list[uuid.UUID]:
    """Ids for the preview (R33): the longest name, the shortest name and one at random,
    de-duplicated, in that order. Ties go to the first candidate."""
    if not candidates:
        return []
    rng = rng or random.Random()
    longest = max(candidates, key=lambda c: len(c[1]))[0]
    shortest = min(candidates, key=lambda c: len(c[1]))[0]
    chosen = rng.choice(list(candidates))[0]
    picked: list[uuid.UUID] = []
    for item in (longest, shortest, chosen):
        if item not in picked:
            picked.append(item)
    return picked


def format_answer(value: Any) -> str:
    """A form answer as Certificate text: lists joined with ", ", booleans as Yes/No."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list | tuple):
        return ", ".join(format_answer(v) for v in value)
    return str(value)


def local_date(starts_at: datetime, timezone: str):
    tz = ZoneInfo(timezone or DEFAULT_TIMEZONE)
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)
    return starts_at.astimezone(tz).date()


def format_event_date(starts_at: datetime, timezone: str) -> str:
    """'25 October 2026', in the University's timezone."""
    d = local_date(starts_at, timezone)
    return f"{d.day} {d:%B %Y}"


def build_values(
    snapshot: dict[str, Any],
    answers: dict[str, Any],
    *,
    event_name: str,
    starts_at: datetime,
    timezone: str,
    club_name: str,
    public_id: str,
) -> tuple[dict[str, str], dict[str, Any]]:
    """Tag values for one Certificate, and its frozen `display` for the Verification Page."""
    values = {tag: format_answer(snapshot.get(tag)) for tag in PROFILE_TAGS}
    values["event_name"] = event_name
    values["event_date"] = format_event_date(starts_at, timezone)
    values["club_name"] = club_name
    values["certificate_id"] = public_id
    for key, answer in (answers or {}).items():
        values[f"form.{key}"] = format_answer(answer)
    display = {
        "name": values["name"],
        "event": event_name,
        "club": club_name,
        "date": local_date(starts_at, timezone).isoformat(),
    }
    return values, display


def rollup_status(pending: int, failed: int) -> CertificateBatchStatus:
    """Batch status from its item counts: running while any is pending."""
    if pending:
        return CertificateBatchStatus.RUNNING
    return CertificateBatchStatus.DONE_WITH_FAILURES if failed else CertificateBatchStatus.DONE


def read_upload(file: BinaryIO, max_mb: int) -> bytes:
    """Read an upload, stopping as soon as it passes `max_mb` (413 `file_too_large`)."""
    limit = max_mb * 1024 * 1024
    chunks: list[bytes] = []
    size = 0
    while chunk := file.read(_CHUNK):
        size += len(chunk)
        if size > limit:
            raise AppError(
                "file_too_large",
                f"The template is larger than {max_mb} MB. Export it smaller and upload again.",
                status.HTTP_413_CONTENT_TOO_LARGE,
            )
        chunks.append(chunk)
    return b"".join(chunks)


def template_key(event_id: uuid.UUID, template_id: uuid.UUID) -> str:
    return f"certificate-templates/{event_id}/{template_id}.pdf"


def certificate_key(event_id: uuid.UUID, public_id: str) -> str:
    return f"certificates/{event_id}/{public_id}.pdf"


def verify_url(public_id: str) -> str:
    return f"{get_settings().frontend_base_url.rstrip('/')}/verify/{public_id}"


# --- reads and lookups -------------------------------------------------------------------


def _not_found(code: str, what: str) -> AppError:
    return AppError(code, f"No {what} has this ID. Check the link and try again.", 404)


def attendee_registration_ids(db: Session, event_id: uuid.UUID) -> list[uuid.UUID]:
    """The Event's Attendees: Confirmed Registrations present or with no attendance row.
    The one place the attendee rule is applied in SQL (see `is_attendee`)."""
    return list(
        db.scalars(
            select(Registration.id)
            .outerjoin(Attendance, Attendance.registration_id == Registration.id)
            .where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
                or_(Attendance.id.is_(None), Attendance.present.is_(True)),
            )
        )
    )


def form_keys(db: Session, event_id: uuid.UUID) -> set[str]:
    return set(
        db.scalars(
            select(FormField.key)
            .join(RegistrationForm, RegistrationForm.id == FormField.form_id)
            .where(RegistrationForm.event_id == event_id)
        )
    )


def _template_for_member(
    db: Session, student: Student, template_id: uuid.UUID
) -> CertificateTemplate:
    template = db.get(CertificateTemplate, template_id)
    if template is None:
        raise _not_found("template_not_found", "Certificate Template")
    require_event_club_member(db, student, template.event_id)
    return template


def _batch_for_member(db: Session, student: Student, batch_id: uuid.UUID) -> CertificateBatch:
    batch = db.get(CertificateBatch, batch_id)
    if batch is None:
        raise _not_found("batch_not_found", "Certificate Batch")
    require_event_club_member(db, student, batch.event_id)
    return batch


def _certificate_for_member(
    db: Session, student: Student, certificate_id: uuid.UUID
) -> Certificate:
    certificate = db.get(Certificate, certificate_id)
    if certificate is None:
        raise _not_found("certificate_not_found", "Certificate")
    require_event_club_member(db, student, certificate.event_id)
    # Lock it so a concurrent Reissue/Revoke can't both pass the `valid` check.
    db.refresh(certificate, with_for_update=True)
    return certificate


def placeholders_of(db: Session, template_id: uuid.UUID) -> list[PlaceholderRow]:
    return list(
        db.scalars(
            select(PlaceholderRow)
            .where(PlaceholderRow.template_id == template_id)
            .order_by(PlaceholderRow.page, PlaceholderRow.y.desc(), PlaceholderRow.x)
        )
    )


def spec_of(row: PlaceholderRow) -> render.PlaceholderSpec:
    return render.PlaceholderSpec(
        tag=row.tag,
        page=row.page,
        x=row.x,
        y=row.y,
        w=row.w,
        h=row.h,
        font_name=row.font_name,
        font_size=row.font_size,
        align=PlaceholderAlign(row.align).value,
    )


@lru_cache(maxsize=32)
def template_bytes(file_key: str) -> bytes:
    """A template's PDF, cached per process: a template file never changes once stored,
    so 500 renders read it once."""
    return get_storage().get(file_key)


def _load_template(template: CertificateTemplate) -> bytes:
    try:
        return template_bytes(template.file_key)
    except StorageNotFound as exc:
        raise AppError(
            "template_file_missing",
            "The template's file is missing from storage. Upload the template again.",
            status.HTTP_409_CONFLICT,
        ) from exc


def page_count(pdf: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf)).pages)


def template_out(
    template: CertificateTemplate, rows: list[PlaceholderRow], pages: int
) -> CertificateTemplateOut:
    return CertificateTemplateOut(
        id=template.id,
        event_id=template.event_id,
        has_text_layer=template.has_text_layer,
        page_count=pages,
        placeholders=[
            PlaceholderIn(
                tag=r.tag,
                page=r.page,
                x=r.x,
                y=r.y,
                w=r.w,
                h=r.h,
                font_name=r.font_name,
                font_size=r.font_size,
                align=PlaceholderAlign(r.align).value,
                source=PlaceholderSource(r.source).value,
            )
            for r in rows
        ],
    )


def certificate_out(cert: Certificate) -> CertificateOut:
    return CertificateOut(
        id=cert.id,
        public_id=cert.public_id,
        event_id=cert.event_id,
        status=CertStatus(cert.status).value,
        superseded_by=cert.superseded_by,
        issued_at=cert.issued_at,
        revoked_reason=cert.revoked_reason,
        revoked_at=cert.revoked_at,
    )


# --- attendance (R27, R28) ---------------------------------------------------------------


def attendance_list(db: Session, student: Student, event_id: uuid.UUID) -> list[AttendanceEntry]:
    require_event_club_member(db, student, event_id)
    rows = db.execute(
        select(Registration.id, Registration.profile_snapshot, Attendance.present)
        .outerjoin(Attendance, Attendance.registration_id == Registration.id)
        .where(
            Registration.event_id == event_id,
            Registration.status == RegistrationStatus.CONFIRMED,
        )
    ).all()
    entries = [
        AttendanceEntry(
            registration_id=reg_id,
            name=str((snap or {}).get("name", "")),
            roll_no=str((snap or {}).get("roll_no", "")),
            present=is_attendee(RegistrationStatus.CONFIRMED, present),
        )
        for reg_id, snap, present in rows
    ]
    return sorted(entries, key=lambda e: (e.name.lower(), e.roll_no))


def update_attendance(
    db: Session, student: Student, event_id: uuid.UUID, absent: list[uuid.UUID]
) -> list[AttendanceEntry]:
    require_event_club_member(db, student, event_id)
    confirmed = set(
        db.scalars(
            select(Registration.id).where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
        )
    )
    unknown = set(absent) - confirmed
    if unknown:
        raise AppError(
            "unknown_registration",
            "These IDs are not Confirmed Registrations of this Event: "
            + ", ".join(sorted(str(u) for u in unknown)),
        )
    if confirmed:
        now = datetime.now(UTC)
        absent_set = set(absent)
        stmt = pg_insert(Attendance).values(
            [
                {
                    "registration_id": reg_id,
                    "present": reg_id not in absent_set,
                    "marked_by": student.id,
                    "marked_at": now,
                }
                for reg_id in confirmed
            ]
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[Attendance.registration_id],
            set_={
                "present": stmt.excluded.present,
                "marked_by": stmt.excluded.marked_by,
                "marked_at": stmt.excluded.marked_at,
                "updated_at": func.now(),
            },
        )
        db.execute(stmt)
    db.commit()
    db.expire_all()
    return attendance_list(db, student, event_id)


# --- templates (R30–R33) -----------------------------------------------------------------


def upload_template(
    db: Session, student: Student, event_id: uuid.UUID, file: BinaryIO
) -> CertificateTemplateOut:
    require_event_club_member(db, student, event_id)
    pdf = read_upload(file, get_settings().max_upload_mb)
    try:
        scan = validate_template(pdf, form_keys(db, event_id))
    except TemplateError as exc:
        raise AppError(exc.code, str(exc), status.HTTP_400_BAD_REQUEST) from exc

    template_id = uuid.uuid4()
    key = template_key(event_id, template_id)
    template = CertificateTemplate(
        id=template_id, event_id=event_id, file_key=key, has_text_layer=scan.has_text_layer
    )
    db.add(template)
    db.flush()
    rows: list[PlaceholderRow] = []
    if scan.has_text_layer:  # R32: with no text layer the Club draws them by hand.
        for tag in scan.tags:
            x, y, w, h = tag.placeholder_box()
            rows.append(
                PlaceholderRow(
                    template_id=template.id,
                    tag=tag.tag,
                    page=tag.page,
                    x=x,
                    y=y,
                    w=w,
                    h=h,
                    font_name=tag.font_name,
                    font_size=tag.font_size,
                    align=PlaceholderAlign(tag.align),
                    source=PlaceholderSource.DETECTED,
                )
            )
        db.add_all(rows)
    get_storage().put(key, pdf, "application/pdf")
    db.commit()
    return template_out(template, placeholders_of(db, template.id), scan.page_count)


def replace_placeholders(
    db: Session, student: Student, template_id: uuid.UUID, placeholders: list[PlaceholderIn]
) -> CertificateTemplateOut:
    template = _template_for_member(db, student, template_id)
    keys = form_keys(db, template.event_id)
    bad = [p.tag for p in placeholders if not is_valid_tag(p.tag, keys)]
    if bad:
        parts = []
        for tag in bad:
            hint = suggest_tag(tag, keys)
            parts.append(
                f"{{{{{tag}}}}} (did you mean {{{{{hint}}}}}?)" if hint else f"{{{{{tag}}}}}"
            )
        raise AppError("unknown_tags", "Unknown Tags: " + "; ".join(parts))
    pages = page_count(_load_template(template))
    out_of_range = sorted({p.page for p in placeholders if p.page >= pages})
    if out_of_range:
        raise AppError(
            "bad_page",
            f"The template has {pages} page(s) (numbered from 0); "
            f"there is no page {', '.join(map(str, out_of_range))}.",
        )
    for row in placeholders_of(db, template.id):
        db.delete(row)
    db.flush()
    db.add_all(
        PlaceholderRow(
            template_id=template.id,
            tag=p.tag,
            page=p.page,
            x=p.x,
            y=p.y,
            w=p.w,
            h=p.h,
            font_name=p.font_name,
            font_size=p.font_size,
            align=PlaceholderAlign(p.align),
            source=PlaceholderSource(p.source),
        )
        for p in placeholders
    )
    db.commit()
    return template_out(template, placeholders_of(db, template.id), pages)


@dataclass
class EventContext:
    event: Event
    club: Club
    timezone: str


def event_context(db: Session, event_id: uuid.UUID) -> EventContext:
    event = db.get(Event, event_id)
    if event is None:  # pragma: no cover - callers have already resolved the Event
        raise _not_found("event_not_found", "Event")
    club = db.get(Club, event.club_id)
    university = db.get(University, club.university_id) if club else None
    return EventContext(event, club, university.timezone if university else DEFAULT_TIMEZONE)


def certificate_values(
    db: Session,
    registration: Registration,
    event: Event,
    club: Club,
    public_id: str,
) -> tuple[dict[str, str], dict[str, Any]]:
    """Tag values and `display` for one Certificate, from the current Profile Snapshot."""
    university = db.get(University, club.university_id)
    return build_values(
        registration.profile_snapshot or {},
        registration.answers or {},
        event_name=event.name,
        starts_at=event.starts_at,
        timezone=university.timezone if university else DEFAULT_TIMEZONE,
        club_name=club.name,
        public_id=public_id,
    )


def preview(
    db: Session, student: Student, template_id: uuid.UUID, rng: random.Random | None = None
) -> bytes:
    """One PDF holding up to three previews (R33). Rendering three in a request is the
    accepted exception to rule 2: it is small and the Club is waiting for it."""
    template = _template_for_member(db, student, template_id)
    pdf = _load_template(template)
    specs = [spec_of(r) for r in placeholders_of(db, template.id)]
    ctx = event_context(db, template.event_id)
    url = verify_url(render.PREVIEW_PUBLIC_ID)

    ids = attendee_registration_ids(db, template.event_id)
    registrations = (
        list(db.scalars(select(Registration).where(Registration.id.in_(ids)))) if ids else []
    )
    by_id = {r.id: r for r in registrations}
    picked = pick_preview(
        [(r.id, str((r.profile_snapshot or {}).get("name", ""))) for r in registrations], rng
    )
    value_sets: list[dict[str, str]] = []
    for reg_id in picked:
        values, _ = certificate_values(
            db, by_id[reg_id], ctx.event, ctx.club, render.PREVIEW_PUBLIC_ID
        )
        value_sets.append(values)
    if not value_sets:
        values, _ = build_values(
            SAMPLE_VALUES,
            {key: f"Sample {key}" for key in form_keys(db, template.event_id)},
            event_name=ctx.event.name,
            starts_at=ctx.event.starts_at,
            timezone=ctx.timezone,
            club_name=ctx.club.name,
            public_id=render.PREVIEW_PUBLIC_ID,
        )
        value_sets.append(values)

    writer = PdfWriter()
    for values in value_sets:
        writer.append(PdfReader(io.BytesIO(render.preview_pdf(pdf, specs, values, url))))
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# --- issuing (shared by the batch job and Reissue) ----------------------------------------


def valid_holder_ids(db: Session, event_id: uuid.UUID) -> set[uuid.UUID]:
    """Registrations that already hold a `valid` Certificate for the Event."""
    return set(
        db.scalars(
            select(Certificate.registration_id).where(
                Certificate.event_id == event_id, Certificate.status == CertStatus.VALID
            )
        )
    )


def issue_certificate(
    db: Session,
    *,
    registration: Registration,
    ctx: EventContext,
    template: CertificateTemplate,
    batch_id: uuid.UUID | None,
) -> Certificate:
    """Render, store and insert one `valid` Certificate. Retries the Certificate ID on a
    unique collision (decision 26). Flushes; the caller commits."""
    pdf = _load_template(template)
    specs = [spec_of(r) for r in placeholders_of(db, template.id)]
    for _ in range(PUBLIC_ID_ATTEMPTS):
        public_id = new_certificate_id()
        if db.scalar(select(Certificate.id).where(Certificate.public_id == public_id)):
            continue
        values, display = certificate_values(db, registration, ctx.event, ctx.club, public_id)
        data = render.render_certificate(pdf, specs, values, public_id, verify_url(public_id))
        key = certificate_key(ctx.event.id, public_id)
        get_storage().put(key, data, "application/pdf")
        cert = Certificate(
            public_id=public_id,
            event_id=ctx.event.id,
            student_id=registration.student_id,
            registration_id=registration.id,
            batch_id=batch_id,
            pdf_file_key=key,
            display=display,
            status=CertStatus.VALID,
        )
        try:
            with db.begin_nested():
                db.add(cert)
        except IntegrityError:  # raced another insert of the same ID
            continue
        return cert
    raise RuntimeError("Could not mint a unique Certificate ID.")


# --- batches (R29, R35) ------------------------------------------------------------------


def batch_counts(db: Session, batch_id: uuid.UUID) -> dict[CertificateBatchItemStatus, int]:
    rows = db.execute(
        select(CertificateBatchItem.status, func.count())
        .where(CertificateBatchItem.batch_id == batch_id)
        .group_by(CertificateBatchItem.status)
    ).all()
    counts = dict.fromkeys(CertificateBatchItemStatus, 0)
    for item_status, n in rows:
        counts[CertificateBatchItemStatus(item_status)] = n
    return counts


def refresh_batch_status(db: Session, batch_id: uuid.UUID) -> CertificateBatchStatus:
    """Set the batch `done` / `done_with_failures` once nothing is pending."""
    counts = batch_counts(db, batch_id)
    new = rollup_status(
        counts[CertificateBatchItemStatus.PENDING], counts[CertificateBatchItemStatus.FAILED]
    )
    batch = db.get(CertificateBatch, batch_id)
    if batch is not None and batch.status != new:
        batch.status = new
        db.flush()
    return new


def batch_out(
    db: Session, batch: CertificateBatch, *, skipped: int = 0, queued: int = 0
) -> CertificateBatchOut:
    counts = batch_counts(db, batch.id)
    return CertificateBatchOut(
        id=batch.id,
        event_id=batch.event_id,
        template_id=batch.template_id,
        status=CertificateBatchStatus(batch.status).value,
        total=sum(counts.values()),
        generated=counts[CertificateBatchItemStatus.GENERATED],
        failed=counts[CertificateBatchItemStatus.FAILED],
        pending=counts[CertificateBatchItemStatus.PENDING],
        skipped_existing=skipped,
        queued=queued,
    )


def _in_flight_ids(db: Session, event_id: uuid.UUID) -> set[uuid.UUID]:
    """Registrations with a pending item in any batch of the Event, so two batches never
    race to issue the same Attendee twice."""
    return set(
        db.scalars(
            select(CertificateBatchItem.registration_id)
            .join(CertificateBatch, CertificateBatch.id == CertificateBatchItem.batch_id)
            .where(
                CertificateBatch.event_id == event_id,
                CertificateBatchItem.status == CertificateBatchItemStatus.PENDING,
            )
        )
    )


def _enqueue_items(
    db: Session,
    batch_id: uuid.UUID,
    item_ids: list[uuid.UUID],
    suffix: dict[uuid.UUID, int] | None = None,
) -> None:
    """Queue one job per item. The items are already committed as `pending`, so if queueing
    stops part-way, every item without a job is marked `failed` with the reason; it then
    shows as failed and `POST /retry` picks it up, instead of waiting forever."""
    from app.certificates.jobs import generate_certificate

    for n, item_id in enumerate(item_ids):
        job_id = f"cert-{item_id}"
        if suffix is not None:
            job_id = f"{job_id}-{suffix[item_id]}"
        try:
            # Through the module attribute, so tests can replace `queue.enqueue`.
            queue.enqueue(generate_certificate, str(item_id), job_id=job_id)
        except Exception as exc:
            unqueued = item_ids[n:]
            for item in db.scalars(
                select(CertificateBatchItem).where(CertificateBatchItem.id.in_(unqueued))
            ):
                item.status = CertificateBatchItemStatus.FAILED
                item.error = f"Could not be queued: {exc}"
            refresh_batch_status(db, batch_id)
            db.commit()
            raise


def _insert_items(db: Session, batch_id: uuid.UUID, reg_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    if not reg_ids:
        return []
    stmt = (
        pg_insert(CertificateBatchItem)
        .values([{"batch_id": batch_id, "registration_id": r} for r in reg_ids])
        .on_conflict_do_nothing(index_elements=["batch_id", "registration_id"])
        .returning(CertificateBatchItem.id)
    )
    return list(db.scalars(stmt))


def create_batch(
    db: Session,
    student: Student,
    event_id: uuid.UUID,
    template_id: uuid.UUID,
    message_subject: str,
    message_body: str,
) -> CertificateBatchOut:
    require_event_club_member(db, student, event_id)
    template = db.get(CertificateTemplate, template_id)
    if template is None or template.event_id != event_id:
        raise _not_found("template_not_found", "Certificate Template for this Event")
    attendees = attendee_registration_ids(db, event_id)
    if not attendees:
        raise AppError(
            "no_attendees",
            "This Event has no Attendees. Confirm Registrations and mark attendance first.",
            status.HTTP_409_CONFLICT,
        )
    # R29, rule 4: nobody gets a second Certificate for the same Event.
    exclude = valid_holder_ids(db, event_id) | _in_flight_ids(db, event_id)
    to_issue = [r for r in attendees if r not in exclude]
    if not to_issue:
        raise AppError(
            "already_issued",
            "Every Attendee already holds a Certificate for this Event (or one is being "
            "generated). Use Reissue to correct one.",
            status.HTTP_409_CONFLICT,
        )
    batch = CertificateBatch(
        event_id=event_id,
        template_id=template.id,
        message_subject=message_subject,
        message_body=message_body,
        created_by=student.id,
        status=CertificateBatchStatus.RUNNING,
    )
    db.add(batch)
    db.flush()
    item_ids = _insert_items(db, batch.id, to_issue)
    db.commit()
    _enqueue_items(db, batch.id, item_ids)
    return batch_out(db, batch, skipped=len(attendees) - len(to_issue), queued=len(item_ids))


def get_batch(db: Session, student: Student, batch_id: uuid.UUID) -> CertificateBatchOut:
    return batch_out(db, _batch_for_member(db, student, batch_id))


def retry_batch(db: Session, student: Student, batch_id: uuid.UUID) -> CertificateBatchOut:
    """Re-queue only `failed` items (R35). Generated items are never touched."""
    batch = _batch_for_member(db, student, batch_id)
    failed = list(
        db.scalars(
            select(CertificateBatchItem)
            .where(
                CertificateBatchItem.batch_id == batch.id,
                CertificateBatchItem.status == CertificateBatchItemStatus.FAILED,
            )
            .with_for_update()
        )
    )
    if not failed:
        raise AppError(
            "nothing_to_retry", "No Certificates in this batch failed.", status.HTTP_409_CONFLICT
        )
    for item in failed:
        item.status = CertificateBatchItemStatus.PENDING
        item.error = None
    batch.status = CertificateBatchStatus.RUNNING
    db.commit()
    # The attempt count makes the job id new, so RQ doesn't dedupe the earlier failed job.
    _enqueue_items(db, batch.id, [i.id for i in failed], {i.id: i.attempts for i in failed})
    return batch_out(db, batch, queued=len(failed))


def add_late_attendees(
    db: Session, student: Student, batch_id: uuid.UUID, registration_ids: list[uuid.UUID]
) -> CertificateBatchOut:
    """R29, decision 33: one new item per newly-present Attendee; only those are generated."""
    batch = _batch_for_member(db, student, batch_id)
    attendees = set(attendee_registration_ids(db, batch.event_id))
    requested = list(dict.fromkeys(registration_ids))
    not_attendees = [r for r in requested if r not in attendees]
    if not_attendees:
        raise AppError(
            "not_an_attendee",
            "These Registrations are not Attendees of this Event: "
            + ", ".join(str(r) for r in not_attendees)
            + ". Mark them present first.",
        )
    holders = valid_holder_ids(db, batch.event_id)
    to_issue = [r for r in requested if r not in holders]
    new_ids = _insert_items(db, batch.id, to_issue)
    if new_ids:
        batch.status = CertificateBatchStatus.RUNNING
    db.commit()
    _enqueue_items(db, batch.id, new_ids)
    return batch_out(db, batch, skipped=len(requested) - len(to_issue), queued=len(new_ids))


# --- Reissue and Revoke (R40, R41, ADR 0001) ---------------------------------------------


def _require_valid(cert: Certificate, action: str) -> None:
    if cert.status != CertStatus.VALID:
        raise AppError(
            "invalid_transition",
            f"Only a valid Certificate can be {action}; this one is "
            f"{CertStatus(cert.status).value}.",
            status.HTTP_409_CONFLICT,
        )


def reissue(
    db: Session, student: Student, certificate_id: uuid.UUID, reason: str
) -> CertificateOut:
    old = _certificate_for_member(db, student, certificate_id)
    _require_valid(old, "reissued")
    registration = db.get(Registration, old.registration_id)
    template = None
    if old.batch_id is not None:
        batch = db.get(CertificateBatch, old.batch_id)
        template = db.get(CertificateTemplate, batch.template_id) if batch else None
    if template is None:
        template = db.scalar(
            select(CertificateTemplate)
            .where(CertificateTemplate.event_id == old.event_id)
            .order_by(CertificateTemplate.created_at.desc())
            .limit(1)
        )
    if template is None or registration is None:
        raise AppError(
            "no_template",
            "This Event has no Certificate Template to reissue from. Upload one first.",
            status.HTTP_409_CONFLICT,
        )
    # One Certificate, so it is rendered inside the request: the accepted exception to
    # rule 2 (heavy work in jobs). Values come from the *current* Profile Snapshot.
    new = issue_certificate(
        db,
        registration=registration,
        ctx=event_context(db, old.event_id),
        template=template,
        batch_id=None,
    )
    db.flush()
    # ADR 0001: only `status` and `superseded_by` change on the old row.
    old.status = CertStatus.SUPERSEDED
    old.superseded_by = new.id
    # There is no column for the reason on the old row, so it is logged.
    logger.info(
        "Certificate %s reissued as %s by %s: %s", old.public_id, new.public_id, student.id, reason
    )
    db.commit()
    from app.notifications.jobs import send_certificate_notification

    queue.enqueue(send_certificate_notification, str(new.id), job_id=f"notify-{new.id}")
    db.refresh(new)
    return certificate_out(new)


def revoke(db: Session, student: Student, certificate_id: uuid.UUID, reason: str) -> CertificateOut:
    cert = _certificate_for_member(db, student, certificate_id)
    _require_valid(cert, "revoked")
    cert.status = CertStatus.REVOKED
    cert.revoked_reason = reason
    cert.revoked_at = datetime.now(UTC)
    db.commit()
    return certificate_out(cert)
