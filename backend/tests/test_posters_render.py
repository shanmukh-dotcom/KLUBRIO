"""Pure poster image logic: loading, QR Area checks, composition, Final Poster output (R19–R22)."""

import io
import uuid

import cv2
import numpy as np
import pytest
from PIL import Image
from pypdf import PdfReader
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

from app.core.settings import get_settings
from app.posters.qr import event_page_url, qr_image, qr_png, qr_svg
from app.posters.render import (
    MIN_QR_PX,
    PosterError,
    PosterImage,
    check_qr_area,
    composite,
    final_pdf,
    final_png,
    load_poster,
    preview_png,
)

URL = "http://localhost:3000/events/0b6f9a7e-5d1c-4c1e-9b1a-2f4e3d5c6b7a"


def _poster_image(w: int = 1200, h: int = 1800) -> Image.Image:
    """A busy, colourful poster so a pasted QR must bring its own quiet zone."""
    image = Image.new("RGB", (w, h), (30, 60, 140))
    for i in range(0, w, 40):
        image.paste((200, 40 + i % 200, 80), (i, 0, i + 20, h))
    return image


def _encode(image: Image.Image, fmt: str) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def _pdf_poster(width_in: float = 4, height_in: float = 6, pages: int = 1) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width_in * 72, height_in * 72))
    for _ in range(pages):
        pdf.setFillColor(Color(0.1, 0.2, 0.6))
        pdf.rect(0, 0, width_in * 72, height_in * 72, fill=1, stroke=0)
        pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def _poster(w: int = 1200, h: int = 1800) -> PosterImage:
    return load_poster(_encode(_poster_image(w, h), "PNG"), "poster.png")


def _decode(image: Image.Image) -> str:
    array = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    text, _points, _ = cv2.QRCodeDetector().detectAndDecode(array)
    return text


# --- Event QR ---------------------------------------------------------------------------


def test_event_page_url_uses_frontend_base_url(monkeypatch):
    monkeypatch.setenv("ORGNISER_FRONTEND_BASE_URL", "https://orgniser.example.edu/")
    get_settings.cache_clear()
    try:
        event_id = uuid.uuid4()
        assert event_page_url(event_id) == f"https://orgniser.example.edu/events/{event_id}"
    finally:
        get_settings.cache_clear()


def test_qr_png_decodes():
    image = Image.open(io.BytesIO(qr_png(URL)))
    assert image.format == "PNG"
    assert _decode(image) == URL


def test_qr_svg_is_svg():
    svg = qr_svg(URL)
    assert isinstance(svg, bytes)
    assert svg.lstrip().startswith((b"<?xml", b"<svg"))
    assert b"<svg" in svg


@pytest.mark.parametrize("size", [300, 333, 512, 1000])
def test_qr_image_exact_size_crisp_and_decodes(size):
    image = qr_image(URL, size)
    assert image.size == (size, size)
    assert image.mode == "RGB"
    # NEAREST scaling: only pure black and pure white pixels.
    assert set(np.unique(np.asarray(image.convert("L"))).tolist()) <= {0, 255}
    # Quiet zone: the outer edge is white all round.
    gray = np.asarray(image.convert("L"))
    assert gray[0, :].min() == 255 and gray[-1, :].min() == 255
    assert gray[:, 0].min() == 255 and gray[:, -1].min() == 255
    assert _decode(image) == URL


# --- Loading ----------------------------------------------------------------------------


def test_load_png():
    poster = load_poster(_encode(_poster_image(800, 1000), "PNG"), "image/png")
    assert (poster.width_px, poster.height_px) == (800, 1000)
    assert poster.image.mode == "RGB"


def test_load_png_with_transparency_flattens_to_rgb():
    rgba = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    poster = load_poster(_encode(rgba, "PNG"), "poster.png")
    assert poster.image.mode == "RGB"
    assert poster.image.getpixel((10, 10)) == (255, 255, 255)


def test_load_jpg():
    poster = load_poster(_encode(_poster_image(900, 1200), "JPEG"), "Poster.JPG")
    assert (poster.width_px, poster.height_px) == (900, 1200)
    assert poster.image.mode == "RGB"


def test_load_pdf_rasterises_page_one_at_300_dpi():
    poster = load_poster(_pdf_poster(4, 6, pages=2), "application/pdf")
    assert (poster.width_px, poster.height_px) == (1200, 1800)
    assert poster.image.mode == "RGB"


def test_load_sniffs_type_without_hint():
    assert load_poster(_pdf_poster(), None).width_px == 1200
    assert load_poster(_encode(_poster_image(500, 600), "PNG")).width_px == 500


@pytest.mark.parametrize(
    ("data", "hint"),
    [
        (b"\x89PNG\r\n\x1a\nthis is not really a png", "poster.png"),
        (b"\xff\xd8\xff\xe0garbage", "image/jpeg"),
        (b"%PDF-1.7\nnot a real pdf", "poster.pdf"),
        (b"", "poster.png"),
    ],
)
def test_corrupt_file_is_rejected(data, hint):
    with pytest.raises(PosterError) as excinfo:
        load_poster(data, hint)
    assert excinfo.value.code == "corrupt_file"
    assert "upload" in str(excinfo.value).lower()


@pytest.mark.parametrize("hint", ["poster.gif", "image/webp", "notes.txt"])
def test_unsupported_type_is_rejected(hint):
    with pytest.raises(PosterError) as excinfo:
        load_poster(b"whatever", hint)
    assert excinfo.value.code == "unsupported_file_type"
    assert "PNG, JPG or PDF" in str(excinfo.value)


def test_png_named_as_png_but_actually_gif_is_rejected():
    gif = _encode(Image.new("RGB", (50, 50)), "GIF")
    with pytest.raises(PosterError) as excinfo:
        load_poster(gif, "poster.png")
    assert excinfo.value.code == "unsupported_file_type"


# --- Preview ----------------------------------------------------------------------------


def test_preview_scale_factor_maps_back_to_original():
    poster = _poster(2400, 3600)
    data, scale = preview_png(poster, max_side=1600)
    preview = Image.open(io.BytesIO(data))
    assert preview.format == "PNG"
    assert max(preview.size) == 1600
    assert scale == pytest.approx(1600 / 3600)
    assert preview.size == (round(2400 * scale), 1600)
    # A box drawn on the preview maps back to original pixels.
    assert round(preview.width / scale) == pytest.approx(2400, abs=2)


def test_preview_does_not_upscale_small_posters():
    poster = _poster(800, 1000)
    data, scale = preview_png(poster)
    assert scale == 1.0
    assert Image.open(io.BytesIO(data)).size == (800, 1000)


# --- QR Area checks ---------------------------------------------------------------------


def test_check_qr_area_accepts_a_good_area():
    check_qr_area(_poster(), 100, 100, MIN_QR_PX, MIN_QR_PX)
    check_qr_area(_poster(), 0, 0, 1200, 1000)  # touches edges, ratio 1.2


@pytest.mark.parametrize(
    "area",
    [
        (1000, 100, 300, 300),  # runs off the right edge
        (100, 1600, 300, 300),  # runs off the bottom edge
        (-1, 0, 300, 300),
        (0, 0, 0, 300),
    ],
)
def test_check_qr_area_outside(area):
    with pytest.raises(PosterError) as excinfo:
        check_qr_area(_poster(), *area)
    assert excinfo.value.code == "qr_area_outside"
    assert "qr_area_outside" in str(excinfo.value)


def test_check_qr_area_too_small_reports_px_and_cm():
    with pytest.raises(PosterError) as excinfo:
        check_qr_area(_poster(), 100, 100, 240, 260)
    error = excinfo.value
    assert error.code == "qr_area_too_small"
    message = str(error)
    assert "240 px" in message and "2.0 cm" in message
    assert f"{MIN_QR_PX} px" in message and "2.5 cm" in message


def test_check_qr_area_not_square_enough():
    with pytest.raises(PosterError) as excinfo:
        check_qr_area(_poster(), 0, 0, 1000, 400)
    assert excinfo.value.code == "qr_area_not_square_enough"
    assert "400 px" in str(excinfo.value)


def test_check_qr_area_ratio_of_exactly_1_5_is_allowed():
    check_qr_area(_poster(), 0, 0, 600, 400)


# --- Composition and Final Poster -------------------------------------------------------


def test_composite_decodes_to_the_url_and_keeps_size():
    poster = _poster()
    before = poster.image.tobytes()
    out = composite(poster, 700, 1300, 420, 380, URL)
    assert out.size == (1200, 1800)
    assert _decode(out) == URL
    # The original poster is not modified.
    assert poster.image.tobytes() == before


def test_composite_centres_square_qr_with_white_quiet_zone():
    poster = _poster()
    x, y, w, h = 100, 200, 450, 330  # QR side 330, centred horizontally
    out = composite(poster, x, y, w, h, URL)
    side = min(w, h)
    left, top = x + (w - side) // 2, y + (h - side) // 2
    gray = np.asarray(out.convert("L"))
    square = gray[top : top + side, left : left + side]
    # Quiet zone: the outer ring of the square is white.
    assert square[0:4, :].min() == 255 and square[-4:, :].min() == 255
    assert square[:, 0:4].min() == 255 and square[:, -4:].min() == 255
    # Outside the square, inside the area, the poster shows through.
    assert gray[top + side // 2, x] != 255


def test_composite_minimum_size_still_decodes():
    out = composite(_poster(), 50, 50, MIN_QR_PX, MIN_QR_PX, URL)
    assert _decode(out) == URL


def test_composite_rejects_bad_area():
    with pytest.raises(PosterError) as excinfo:
        composite(_poster(), 0, 0, 100, 100, URL)
    assert excinfo.value.code == "qr_area_too_small"


def test_composite_on_pdf_poster_decodes():
    poster = load_poster(_pdf_poster(), "poster.pdf")
    out = composite(poster, 400, 1200, 400, 400, URL)
    assert _decode(out) == URL


def test_final_png_round_trips_and_decodes():
    out = composite(_poster(), 700, 1300, 400, 400, URL)
    image = Image.open(io.BytesIO(final_png(out)))
    assert image.format == "PNG"
    assert image.size == (1200, 1800)
    assert round(image.info["dpi"][0]) == 300
    assert _decode(image) == URL


def test_final_pdf_has_one_page_sized_at_300_dpi():
    out = composite(_poster(), 700, 1300, 400, 400, URL)
    reader = PdfReader(io.BytesIO(final_pdf(out)))
    assert len(reader.pages) == 1
    box = reader.pages[0].mediabox
    assert float(box.width) == pytest.approx(1200 * 72 / 300)  # 4 in
    assert float(box.height) == pytest.approx(1800 * 72 / 300)  # 6 in


def test_final_pdf_qr_survives_rasterisation():
    out = composite(_poster(), 700, 1300, 400, 400, URL)
    poster = load_poster(final_pdf(out), "final.pdf")
    assert (poster.width_px, poster.height_px) == (1200, 1800)
    assert _decode(poster.image) == URL
