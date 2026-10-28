"""The `render_poster` job (P3, R22): composite the Event QR into the Poster's QR Area and
store the Final Poster as PNG and PDF.

Idempotent (RULES.md, engineering rule 4): a re-run rebuilds the same files under the same
keys and overwrites them. Follows the convention in `app.jobs.queue`.
"""

import uuid

from sqlalchemy.orm import Session

from app.core.storage import get_storage
from app.jobs.queue import job_session
from app.posters import render
from app.posters.models import Poster, PosterRenderStatus
from app.posters.qr import event_page_url
from app.posters.service import final_keys, qr_area_row


def do_render_poster(db: Session, poster_id: uuid.UUID | str) -> None:
    """Render one Poster inside `db`. On any failure it marks the Poster `failed` (committed,
    so the status survives the job session's rollback) and re-raises."""
    poster_id = uuid.UUID(str(poster_id))
    poster = db.get(Poster, poster_id)
    if poster is None:
        return  # deleted with its Event since it was queued; nothing to do
    try:
        area = qr_area_row(db, poster.id)
        if area is None:
            raise render.PosterError("qr_area_missing", "The Poster has no QR Area.")
        storage = get_storage()
        original = render.load_poster(storage.get(poster.original_file_key))
        image = render.composite(
            original, area.x, area.y, area.w, area.h, event_page_url(poster.event_id)
        )
        png_key, pdf_key = final_keys(poster)
        storage.put(png_key, render.final_png(image), "image/png")
        storage.put(pdf_key, render.final_pdf(image), "application/pdf")
        poster.final_png_key = png_key
        poster.final_pdf_key = pdf_key
        poster.render_status = PosterRenderStatus.DONE
        db.flush()
    except Exception:
        # Failures here come from storage or image work, not the database, so the session
        # is still usable. Commit `failed` so it survives the job session's rollback.
        poster.render_status = PosterRenderStatus.FAILED
        db.commit()
        raise


def render_poster(poster_id: str) -> None:
    """RQ entry point, queued by `POST /posters/{id}/render`."""
    with job_session() as db:
        do_render_poster(db, poster_id)
