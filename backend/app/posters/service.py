"""Event QR and Poster logic (P3): R19–R22, decisions 9, 30, 36.

Routers stay thin and call these. Image work comes from the pure modules `qr.py` and
`render.py`; compositing the Final Poster runs in the `render_poster` job, never in a request.
Writes only P3's tables (`posters`, `qr_areas`).
"""

import uuid
from typing import BinaryIO, Literal

from fastapi import status
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.core.errors import AppError
from app.core.permissions import require_event_club_member
from app.core.settings import get_settings
from app.core.storage import StorageNotFound, get_storage
from app.jobs import queue
from app.posters import render
from app.posters.models import Poster, PosterRenderStatus
from app.posters.models import QrArea as QrAreaRow
from app.posters.qr import event_page_url, qr_png, qr_svg
from app.posters.schemas import PosterOut, QrArea

PREVIEW_MAX_SIDE = 1600
_CHUNK = 1024 * 1024

# Content types we trust as a hint for `render.load_poster`; anything else falls back to the
# filename's extension, then to sniffing the bytes.
_KNOWN_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
}

CONTENT_TYPES = {"png": "image/png", "pdf": "application/pdf", "svg": "image/svg+xml"}


# --- keys and small pure helpers -------------------------------------------------------------


def poster_prefix(poster: Poster) -> str:
    return f"posters/{poster.event_id}/{poster.id}"


def original_key(event_id: uuid.UUID, poster_id: uuid.UUID, ext: str) -> str:
    return f"posters/{event_id}/{poster_id}/original.{ext}"


def preview_key(poster: Poster) -> str:
    return f"{poster_prefix(poster)}/preview.png"


def final_keys(poster: Poster) -> tuple[str, str]:
    prefix = poster_prefix(poster)
    return f"{prefix}/final.png", f"{prefix}/final.pdf"


def preview_scale(width_px: int, height_px: int, max_side: int = PREVIEW_MAX_SIDE) -> float:
    """Preview px per original px; the same formula `render.preview_png` uses."""
    return min(1.0, max_side / max(width_px, height_px))


def file_extension(data: bytes) -> str:
    """Extension for a stored original, from its magic bytes (the file is already validated)."""
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\x89PNG"):
        return "png"
    return "jpg"


def type_hint(content_type: str | None, filename: str | None) -> str | None:
    """What to tell `render.load_poster` about the upload's type."""
    if content_type and content_type.lower() in _KNOWN_CONTENT_TYPES:
        return content_type.lower()
    if filename and "." in filename:
        return filename
    if content_type and content_type.lower() not in ("", "application/octet-stream"):
        return content_type  # e.g. image/gif: rejected by load_poster with its own message
    return None  # sniff the bytes


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
                f"The file is larger than {max_mb} MB. Export the poster smaller "
                f"(300 DPI at the printed size is enough) and upload it again.",
                status.HTTP_413_CONTENT_TOO_LARGE,
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _poster_error(exc: render.PosterError) -> AppError:
    return AppError(exc.code, exc.message, status.HTTP_400_BAD_REQUEST)


# --- reads -----------------------------------------------------------------------------------


def get_poster_for_member(db: Session, student: Student, poster_id: uuid.UUID) -> Poster:
    """The Poster, if the Student is a Club member of its Event's Club; 404/403 otherwise."""
    poster = db.get(Poster, poster_id)
    if poster is None:
        raise AppError(
            "poster_not_found",
            "No Poster has this ID. Check the link, or upload the poster again.",
            status.HTTP_404_NOT_FOUND,
        )
    require_event_club_member(db, student, poster.event_id)
    return poster


def qr_area_row(db: Session, poster_id: uuid.UUID) -> QrAreaRow | None:
    return db.scalar(select(QrAreaRow).where(QrAreaRow.poster_id == poster_id))


def poster_out(db: Session, poster: Poster) -> PosterOut:
    area = qr_area_row(db, poster.id)
    return PosterOut(
        id=poster.id,
        event_id=poster.event_id,
        width_px=poster.width_px,
        height_px=poster.height_px,
        qr_area=QrArea(x=area.x, y=area.y, w=area.w, h=area.h) if area else None,
        render_status=PosterRenderStatus(poster.render_status).value,
    )


# --- Event QR (R19) --------------------------------------------------------------------------


def event_qr(
    db: Session, student: Student, event_id: uuid.UUID, fmt: Literal["png", "svg"]
) -> tuple[bytes, str]:
    """The Event QR, pointing at the Event page (never the form), and its content type."""
    require_event_club_member(db, student, event_id)
    url = event_page_url(event_id)
    data = qr_svg(url) if fmt == "svg" else qr_png(url)
    return data, CONTENT_TYPES[fmt]


# --- Posters (R20–R22) -----------------------------------------------------------------------


def upload_poster(
    db: Session,
    student: Student,
    event_id: uuid.UUID,
    file: BinaryIO,
    content_type: str | None,
    filename: str | None,
) -> Poster:
    require_event_club_member(db, student, event_id)
    data = read_upload(file, get_settings().max_upload_mb)
    try:
        # A PDF is rasterised at 300 DPI here: one page, needed to validate it (decision 30).
        loaded = render.load_poster(data, type_hint(content_type, filename))
    except render.PosterError as exc:
        raise _poster_error(exc) from exc

    poster_id = uuid.uuid4()
    ext = file_extension(data)
    key = original_key(event_id, poster_id, ext)
    poster = Poster(
        id=poster_id,
        event_id=event_id,
        original_file_key=key,
        width_px=loaded.width_px,
        height_px=loaded.height_px,
        render_status=PosterRenderStatus.NONE,
        uploaded_by=student.id,
    )
    db.add(poster)
    db.flush()
    get_storage().put(key, data, CONTENT_TYPES.get(ext, "image/jpeg"))
    db.commit()
    return poster


def _load_original(poster: Poster) -> render.PosterImage:
    try:
        data = get_storage().get(poster.original_file_key)
    except StorageNotFound as exc:
        raise AppError(
            "poster_file_missing",
            "The uploaded poster file is missing from storage. Upload the poster again.",
            status.HTTP_409_CONFLICT,
        ) from exc
    return render.load_poster(data)


def poster_preview(db: Session, student: Student, poster_id: uuid.UUID) -> tuple[bytes, Poster]:
    """The preview PNG for marking the QR Area, cached in storage after the first call."""
    poster = get_poster_for_member(db, student, poster_id)
    storage = get_storage()
    key = preview_key(poster)
    try:
        return storage.get(key), poster
    except StorageNotFound:
        pass
    png, _scale = render.preview_png(_load_original(poster), max_side=PREVIEW_MAX_SIDE)
    storage.put(key, png, "image/png")
    return png, poster


def set_qr_area(db: Session, student: Student, poster_id: uuid.UUID, body: QrArea) -> Poster:
    """Save the QR Area (original pixels). A changed area invalidates a done Final Poster."""
    poster = get_poster_for_member(db, student, poster_id)
    # check_qr_area only reads the dimensions, so don't load the full-resolution poster.
    dims = render.PosterImage(
        image=Image.new("1", (1, 1)), width_px=poster.width_px, height_px=poster.height_px
    )
    try:
        render.check_qr_area(dims, body.x, body.y, body.w, body.h)
    except render.PosterError as exc:
        raise _poster_error(exc) from exc

    area = qr_area_row(db, poster.id)
    if area is None:
        db.add(QrAreaRow(poster_id=poster.id, x=body.x, y=body.y, w=body.w, h=body.h))
        changed = True
    else:
        changed = (area.x, area.y, area.w, area.h) != (body.x, body.y, body.w, body.h)
        area.x, area.y, area.w, area.h = body.x, body.y, body.w, body.h
    if changed and poster.render_status == PosterRenderStatus.DONE:
        poster.render_status = PosterRenderStatus.NONE
    db.commit()
    return poster


def request_render(db: Session, student: Student, poster_id: uuid.UUID) -> Poster:
    """Queue the Final Poster render. Compositing never runs in the request (rule 2)."""
    from app.posters.jobs import render_poster

    poster = get_poster_for_member(db, student, poster_id)
    if qr_area_row(db, poster.id) is None:
        raise AppError(
            "qr_area_missing",
            "Mark the QR Area on the poster before rendering the Final Poster.",
            status.HTTP_409_CONFLICT,
        )
    previous = poster.render_status
    poster.render_status = PosterRenderStatus.QUEUED
    db.commit()
    # Through the module attribute, so tests can replace `queue.enqueue`.
    try:
        queue.enqueue(render_poster, str(poster.id), job_id=f"render_poster-{poster.id}")
    except Exception:
        # Don't leave the Poster showing `queued` for a job that was never queued.
        poster.render_status = previous
        db.commit()
        raise
    return poster


def final_poster(
    db: Session, student: Student, poster_id: uuid.UUID, fmt: Literal["png", "pdf"]
) -> tuple[bytes, str]:
    poster = get_poster_for_member(db, student, poster_id)
    key = poster.final_pdf_key if fmt == "pdf" else poster.final_png_key
    if poster.render_status != PosterRenderStatus.DONE or not key:
        raise AppError(
            "not_rendered",
            "The Final Poster isn't ready. Render it first, then wait until its status is done.",
            status.HTTP_409_CONFLICT,
        )
    try:
        data = get_storage().get(key)
    except StorageNotFound as exc:
        raise AppError(
            "not_rendered",
            "The Final Poster file is missing. Render the poster again.",
            status.HTTP_409_CONFLICT,
        ) from exc
    return data, CONTENT_TYPES[fmt]
