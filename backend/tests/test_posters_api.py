"""Event QR and Poster endpoints (P3, R19–R22). Pure helper tests run without a database;
API tests use `client` + `db` and skip when Postgres is not available."""

import io
import uuid

import pytest
from PIL import Image
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

from app.core.errors import AppError
from app.core.settings import get_settings
from app.core.storage import LocalStorage
from app.posters import jobs, service
from app.posters.models import Poster, PosterRenderStatus
from app.posters.render import MIN_QR_PX
from tests.factories import login, make_club, make_event, make_student

API = "/api/v1"


# --- helpers ---------------------------------------------------------------------------------


def _png(w: int = 1200, h: int = 1800, fmt: str = "PNG") -> bytes:
    image = Image.new("RGB", (w, h), (30, 60, 140))
    for i in range(0, w, 40):
        image.paste((200, 40 + i % 200, 80), (i, 0, i + 20, h))
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def _pdf(width_in: float = 4, height_in: float = 6) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width_in * 72, height_in * 72))
    pdf.setFillColor(Color(0.1, 0.2, 0.6))
    pdf.rect(0, 0, width_in * 72, height_in * 72, fill=1, stroke=0)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


@pytest.fixture
def storage(tmp_path, monkeypatch) -> LocalStorage:
    local = LocalStorage(tmp_path)
    monkeypatch.setattr(service, "get_storage", lambda: local)
    monkeypatch.setattr(jobs, "get_storage", lambda: local)
    return local


@pytest.fixture
def setup(db, client):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    login(client, db, president)
    return president, club, event


def _upload(client, event_id, data: bytes, name: str = "poster.png", ctype: str = "image/png"):
    return client.post(f"{API}/events/{event_id}/posters", files={"file": (name, data, ctype)})


# --- pure helpers ----------------------------------------------------------------------------


def test_read_upload_within_limit():
    data = b"x" * (1024 * 1024)
    assert service.read_upload(io.BytesIO(data), max_mb=1) == data


def test_read_upload_over_limit_is_413():
    with pytest.raises(AppError) as info:
        service.read_upload(io.BytesIO(b"x" * (1024 * 1024 + 1)), max_mb=1)
    assert info.value.code == "file_too_large"
    assert info.value.status_code == 413


def test_file_extension_sniffs_magic_bytes():
    assert service.file_extension(b"%PDF-1.7") == "pdf"
    assert service.file_extension(b"\x89PNG\r\n") == "png"
    assert service.file_extension(b"\xff\xd8\xff") == "jpg"


def test_type_hint():
    assert service.type_hint("image/png", "a.png") == "image/png"
    assert service.type_hint("application/octet-stream", "a.pdf") == "a.pdf"
    assert service.type_hint("image/gif", None) == "image/gif"
    assert service.type_hint(None, None) is None


def test_preview_scale():
    assert service.preview_scale(1200, 800) == 1.0
    assert service.preview_scale(3200, 1600) == 0.5


def test_keys():
    poster = Poster(id=uuid.uuid4(), event_id=uuid.uuid4())
    prefix = f"posters/{poster.event_id}/{poster.id}"
    assert service.preview_key(poster) == f"{prefix}/preview.png"
    assert service.final_keys(poster) == (f"{prefix}/final.png", f"{prefix}/final.pdf")
    assert service.original_key(poster.event_id, poster.id, "pdf") == f"{prefix}/original.pdf"


# --- Event QR --------------------------------------------------------------------------------


def test_event_qr_png_and_svg(client, setup):
    _, _, event = setup
    png = client.get(f"{API}/events/{event.id}/qr")
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    assert png.content.startswith(b"\x89PNG")
    svg = client.get(f"{API}/events/{event.id}/qr", params={"format": "svg"})
    assert svg.status_code == 200
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in svg.content


def test_event_qr_unknown_event_is_404(client, setup):
    response = client.get(f"{API}/events/{uuid.uuid4()}/qr")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_not_found"


def test_event_qr_requires_login(client, db):
    president = make_student(db)
    event = make_event(db, make_club(db, president=president), president)
    assert client.get(f"{API}/events/{event.id}/qr").status_code == 401


# --- upload ----------------------------------------------------------------------------------


def test_upload_png(client, db, setup, storage):
    president, _, event = setup
    response = _upload(client, event.id, _png(1200, 1800))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["width_px"] == 1200 and body["height_px"] == 1800
    assert body["render_status"] == "none" and body["qr_area"] is None
    poster = db.get(Poster, uuid.UUID(body["id"]))
    assert poster.uploaded_by == president.id
    assert poster.original_file_key == f"posters/{event.id}/{poster.id}/original.png"
    assert storage.exists(poster.original_file_key)


def test_upload_pdf_measured_at_300_dpi(client, db, setup, storage):
    _, _, event = setup
    response = _upload(client, event.id, _pdf(4, 6), "poster.pdf", "application/pdf")
    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["width_px"], body["height_px"]) == (1200, 1800)
    poster = db.get(Poster, uuid.UUID(body["id"]))
    assert poster.original_file_key.endswith("/original.pdf")


def test_upload_gif_rejected(client, setup, storage):
    _, _, event = setup
    response = _upload(client, event.id, _png(100, 100, "GIF"), "poster.gif", "image/gif")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_upload_oversized_rejected(client, setup, storage, monkeypatch):
    _, _, event = setup
    settings = get_settings().model_copy(update={"max_upload_mb": 1})
    monkeypatch.setattr(service, "get_settings", lambda: settings)
    response = _upload(client, event.id, b"\x89PNG" + b"0" * (1024 * 1024 + 10))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


# --- preview, QR Area, render, final ---------------------------------------------------------


@pytest.fixture
def poster_id(client, setup, storage) -> str:
    _, _, event = setup
    response = _upload(client, event.id, _png(3200, 2400))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_preview_headers_and_cache(client, db, poster_id, storage):
    response = client.get(f"{API}/posters/{poster_id}/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert float(response.headers["X-Preview-Scale"]) == pytest.approx(0.5)
    assert response.headers["X-Original-Width"] == "3200"
    assert response.headers["X-Original-Height"] == "2400"
    assert Image.open(io.BytesIO(response.content)).size == (1600, 1200)
    poster = db.get(Poster, uuid.UUID(poster_id))
    assert storage.exists(service.preview_key(poster))
    again = client.get(f"{API}/posters/{poster_id}/preview")
    assert again.content == response.content


def test_qr_area_too_small(client, poster_id):
    small = MIN_QR_PX - 1
    response = client.put(
        f"{API}/posters/{poster_id}/qr-area", json={"x": 0, "y": 0, "w": small, "h": small}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "qr_area_too_small"


def test_qr_area_outside(client, poster_id):
    response = client.put(
        f"{API}/posters/{poster_id}/qr-area", json={"x": 3000, "y": 0, "w": 400, "h": 400}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "qr_area_outside"


def test_qr_area_upsert_and_reset_done(client, db, poster_id):
    area = {"x": 100, "y": 100, "w": 400, "h": 400}
    first = client.put(f"{API}/posters/{poster_id}/qr-area", json=area)
    assert first.status_code == 200
    assert first.json()["qr_area"] == area

    poster = db.get(Poster, uuid.UUID(poster_id))
    poster.render_status = PosterRenderStatus.DONE
    db.flush()

    moved = {**area, "x": 200}
    second = client.put(f"{API}/posters/{poster_id}/qr-area", json=moved)
    assert second.status_code == 200
    assert second.json()["qr_area"] == moved
    assert second.json()["render_status"] == "none"


def test_render_requires_qr_area(client, poster_id, enqueued):
    response = client.post(f"{API}/posters/{poster_id}/render")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "qr_area_missing"
    assert enqueued == []


def test_render_enqueues_one_job(client, poster_id, enqueued):
    client.put(f"{API}/posters/{poster_id}/qr-area", json={"x": 0, "y": 0, "w": 400, "h": 400})
    response = client.post(f"{API}/posters/{poster_id}/render")
    assert response.status_code == 202
    assert response.json()["render_status"] == "queued"
    assert enqueued == [(jobs.render_poster, (poster_id,))]


def test_final_before_render_is_409(client, poster_id):
    response = client.get(f"{API}/posters/{poster_id}/final")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_rendered"


def test_final_after_render(client, db, poster_id, storage):
    client.put(f"{API}/posters/{poster_id}/qr-area", json={"x": 0, "y": 0, "w": 400, "h": 400})
    jobs.do_render_poster(db, poster_id)
    png = client.get(f"{API}/posters/{poster_id}/final")
    assert png.status_code == 200
    assert png.headers["content-type"] == "image/png"
    pdf = client.get(f"{API}/posters/{poster_id}/final", params={"format": "pdf"})
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")


def test_unknown_poster_is_404(client, setup):
    response = client.get(f"{API}/posters/{uuid.uuid4()}/preview")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "poster_not_found"


# --- permissions -----------------------------------------------------------------------------


def test_outsider_gets_403_everywhere(client, db, poster_id, setup):
    _, _, event = setup
    login(client, db, make_student(db))
    area = {"x": 0, "y": 0, "w": 400, "h": 400}
    requests = [
        client.get(f"{API}/events/{event.id}/qr"),
        _upload(client, event.id, _png(400, 400)),
        client.get(f"{API}/posters/{poster_id}/preview"),
        client.put(f"{API}/posters/{poster_id}/qr-area", json=area),
        client.post(f"{API}/posters/{poster_id}/render"),
        client.get(f"{API}/posters/{poster_id}/final"),
    ]
    for response in requests:
        assert response.status_code == 403, response.request.url
        assert response.json()["error"]["code"] == "forbidden"
