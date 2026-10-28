"""The `render_poster` job (P3, R22): the Final Poster carries a scannable Event QR, re-runs
overwrite the same keys (rule 4), and failures mark the Poster `failed`."""

import io
import uuid

import cv2
import numpy as np
import pytest
from PIL import Image
from pypdf import PdfReader

from app.core.storage import LocalStorage, StorageNotFound
from app.posters import jobs, service
from app.posters.models import Poster, PosterRenderStatus, QrArea
from app.posters.qr import event_page_url
from tests.factories import make_club, make_event, make_student


def _png(w: int = 1200, h: int = 1800) -> bytes:
    image = Image.new("RGB", (w, h), (30, 60, 140))
    for i in range(0, w, 40):
        image.paste((200, 40 + i % 200, 80), (i, 0, i + 20, h))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _decode(png: bytes) -> str:
    image = Image.open(io.BytesIO(png)).convert("RGB")
    array = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
    text, _points, _ = cv2.QRCodeDetector().detectAndDecode(array)
    return text


@pytest.fixture
def storage(tmp_path, monkeypatch) -> LocalStorage:
    local = LocalStorage(tmp_path)
    monkeypatch.setattr(service, "get_storage", lambda: local)
    monkeypatch.setattr(jobs, "get_storage", lambda: local)
    return local


@pytest.fixture
def poster(db, storage) -> Poster:
    president = make_student(db)
    event = make_event(db, make_club(db, president=president), president)
    poster_id = uuid.uuid4()
    key = service.original_key(event.id, poster_id, "png")
    storage.put(key, _png(), "image/png")
    poster = Poster(
        id=poster_id,
        event_id=event.id,
        original_file_key=key,
        width_px=1200,
        height_px=1800,
        render_status=PosterRenderStatus.QUEUED,
        uploaded_by=president.id,
    )
    db.add(poster)
    db.flush()
    db.add(QrArea(poster_id=poster.id, x=400, y=600, w=400, h=400))
    db.flush()
    return poster


def test_render_poster_qr_decodes_to_event_page(db, storage, poster):
    jobs.do_render_poster(db, str(poster.id))
    db.refresh(poster)
    png_key, pdf_key = service.final_keys(poster)
    assert poster.render_status == PosterRenderStatus.DONE
    assert (poster.final_png_key, poster.final_pdf_key) == (png_key, pdf_key)

    final_png = storage.get(png_key)
    assert Image.open(io.BytesIO(final_png)).size == (1200, 1800)
    assert _decode(final_png) == event_page_url(poster.event_id)
    assert len(PdfReader(io.BytesIO(storage.get(pdf_key))).pages) == 1


def test_render_poster_is_idempotent(db, storage, poster):
    jobs.do_render_poster(db, poster.id)
    first = storage.get(poster.final_png_key)
    jobs.do_render_poster(db, poster.id)
    db.refresh(poster)
    assert poster.render_status == PosterRenderStatus.DONE
    assert storage.get(poster.final_png_key) == first
    files = sorted(p.name for p in storage.base_dir.rglob("*") if p.is_file())
    assert files == ["final.pdf", "final.png", "original.png"]


def test_render_poster_failure_marks_failed(db, storage, poster):
    storage.delete(poster.original_file_key)
    with pytest.raises(StorageNotFound):
        jobs.do_render_poster(db, poster.id)
    db.refresh(poster)
    assert poster.render_status == PosterRenderStatus.FAILED


def test_render_poster_missing_poster_is_noop(db, storage):
    jobs.do_render_poster(db, uuid.uuid4())
