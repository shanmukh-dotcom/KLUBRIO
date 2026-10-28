"""Certificate rendering (R33, R34)."""

import io
import time

import pdfplumber
import pytest
from PIL import Image
from pypdf import PdfReader
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from app.certificates.render import (
    PREVIEW_PUBLIC_ID,
    PlaceholderSpec,
    fit_font_size,
    font_for,
    preview_pdf,
    render_certificate,
)
from app.certificates.tags import validate_template

PAGE = (842.0, 595.0)
FORM_KEYS = {"team_name"}
PUBLIC_ID = "ORG-7KQ2-M9XD"
VERIFY_URL = f"http://localhost:3000/verify/{PUBLIC_ID}"
VALUES = {
    "name": "Ananya Raghavan",
    "form.team_name": "Rockets",
    "event_date": "25 Oct 2026",
    "event_name": "HackFest",
}


def _pdf(draw, pages: int = 1) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=PAGE)
    for page_no in range(pages):
        draw(c, page_no)
        c.showPage()
    c.save()
    return buf.getvalue()


def _template(c: canvas.Canvas, page_no: int) -> None:
    c.setFillColorRGB(0.92, 0.94, 1.0)  # coloured background
    c.rect(0, 0, *PAGE, stroke=0, fill=1)
    c.setFillColorRGB(0, 0, 0)
    if page_no == 0:
        c.setFont("Times-Roman", 32)
        c.drawCentredString(PAGE[0] / 2, 340, "{{name}}")
        c.setFont("Helvetica", 14)
        c.drawString(80, 250, "Team: {{ form.team_name }} took part")
        c.drawRightString(780, 120, "{{event_date}}")
    else:
        c.setFont("Helvetica", 18)
        c.drawCentredString(PAGE[0] / 2, 300, "Event: {{event_name}}")


def _placeholders(template: bytes) -> list[PlaceholderSpec]:
    scan = validate_template(template, FORM_KEYS)
    return [
        PlaceholderSpec(t.tag, t.page, *t.placeholder_box(), t.font_name, t.font_size, t.align)
        for t in scan.tags
    ]


def _text(pdf: bytes) -> list[str]:
    with pdfplumber.open(io.BytesIO(pdf)) as doc:
        return [page.extract_text() or "" for page in doc.pages]


def test_font_mapping():
    assert font_for("ABCDEF+TimesNewRomanPSMT") in ("NotoSerif", "Times-Roman")
    assert font_for("Lora-SerifBold") in ("NotoSerif", "Times-Roman")
    assert font_for("Helvetica") in ("NotoSans", "Helvetica")
    assert font_for("XYZ+Montserrat") in ("NotoSans", "Helvetica")


def test_fit_font_size():
    font = font_for("sans")
    assert fit_font_size("Al", font, 30, 500) == 30
    long = "Venkata Subramanya Lakshmi Narasimha Chakravarthy Sreenivasan"
    size = fit_font_size(long, font, 30, 300)
    assert 6 <= size < 30
    assert pdfmetrics.stringWidth(long, font, size) <= 300
    assert fit_font_size(long * 10, font, 30, 50) == 6  # never below min_size


def test_render_replaces_tags_and_stamps_id():
    template = _pdf(_template, pages=2)
    out = render_certificate(template, _placeholders(template), VALUES, PUBLIC_ID, VERIFY_URL)

    page1, page2 = _text(out)
    assert "Ananya Raghavan" in page1
    assert "Team: Rockets took part" in page1
    assert "25 Oct 2026" in page1
    assert PUBLIC_ID in page1
    assert "Event: HackFest" in page2
    for text in (page1, page2):
        assert "{{" not in text and "}}" not in text
    assert "{{name}}" not in page1
    assert len(PdfReader(io.BytesIO(out)).pages) == 2

    # Verification QR image on page 1, bottom-right.
    with pdfplumber.open(io.BytesIO(out)) as doc:
        images = doc.pages[0].images
    assert images
    qr = images[-1]
    assert qr["x1"] > PAGE[0] - 80 and qr["bottom"] > PAGE[1] - 140


def test_id_text_not_duplicated_when_template_has_certificate_id():
    def draw(c, _):
        c.setFont("Helvetica", 12)
        c.drawString(60, 60, "Certificate ID: {{certificate_id}}")
        c.drawCentredString(PAGE[0] / 2, 300, "{{name}}")

    template = _pdf(draw)
    out = render_certificate(template, _placeholders(template), VALUES, PUBLIC_ID, VERIFY_URL)
    text = _text(out)[0]
    assert text.count(PUBLIC_ID) == 1
    assert "{{" not in text
    with pdfplumber.open(io.BytesIO(out)) as doc:
        assert doc.pages[0].images  # QR still drawn


def test_long_name_shrinks_to_fit_its_box():
    template = _pdf(_template)
    placeholders = _placeholders(template)
    name_box = next(p for p in placeholders if p.tag == "name")
    long = "Venkata Subramanya Lakshmi Narasimha Chakravarthy Sreenivasan Iyer " * 2
    out = render_certificate(
        template, placeholders, {**VALUES, "name": long}, PUBLIC_ID, VERIFY_URL
    )

    with pdfplumber.open(io.BytesIO(out)) as doc:
        page = doc.pages[0]
        name_chars = [
            c
            for c in page.chars
            if "Noto" in c["fontname"] or c["fontname"] == "Times-Roman"
            if abs((page.height - c["bottom"]) - name_box.y) < name_box.h
        ]
    assert name_chars
    left = min(c["x0"] for c in name_chars)
    right = max(c["x1"] for c in name_chars)
    assert left >= name_box.x - 1
    assert right <= name_box.x + name_box.w + 1
    assert max(c["size"] for c in name_chars) < name_box.font_size


def test_hand_drawn_placeholder_on_image_template():
    img = Image.new("RGB", (421, 298), (250, 245, 230))
    png = io.BytesIO()
    img.save(png, format="PNG")

    def draw(c, _):
        c.drawImage(ImageReader(io.BytesIO(png.getvalue())), 0, 0, *PAGE)

    template = _pdf(draw)
    box = PlaceholderSpec("name", 0, 221, 300, 400, 40, "Garamond", 28, "center")
    out = render_certificate(template, [box], VALUES, PUBLIC_ID, VERIFY_URL)
    text = _text(out)[0]
    assert "Ananya Raghavan" in text and PUBLIC_ID in text


def test_preview():
    template = _pdf(_template)
    out = preview_pdf(template, _placeholders(template), VALUES, VERIFY_URL)
    text = _text(out)[0]
    # The watermark is drawn rotated, so read its glyphs rather than the text lines.
    with pdfplumber.open(io.BytesIO(out)) as doc:
        big = "".join(c["text"] for c in doc.pages[0].chars if c["size"] > 60)
    assert sorted(big) == sorted("PREVIEW")
    assert PREVIEW_PUBLIC_ID in text
    assert "Ananya Raghavan" in text


def test_fifty_renders_are_fast():
    template = _pdf(_template)
    placeholders = _placeholders(template)
    render_certificate(template, placeholders, VALUES, PUBLIC_ID, VERIFY_URL)  # warm cache

    start = time.perf_counter()
    for i in range(50):
        render_certificate(
            template, placeholders, {**VALUES, "name": f"Student {i}"}, PUBLIC_ID, VERIFY_URL
        )
    per_cert_ms = (time.perf_counter() - start) / 50 * 1000
    print(f"\nrender_certificate: {per_cert_ms:.1f} ms per certificate")
    assert per_cert_ms < 100


@pytest.mark.parametrize("align", ["left", "center", "right"])
def test_alignment_is_respected(align):
    def draw(c, _):
        c.setFont("Helvetica", 10)
        c.drawString(40, 40, "x")

    box = PlaceholderSpec("name", 0, 200, 300, 400, 30, "Helvetica", 20, align)
    out = render_certificate(_pdf(draw), [box], {"name": "Ravi"}, PUBLIC_ID, VERIFY_URL)
    with pdfplumber.open(io.BytesIO(out)) as doc:
        chars = [c for c in doc.pages[0].chars if c["size"] == pytest.approx(20)]
    left, right = min(c["x0"] for c in chars), max(c["x1"] for c in chars)
    if align == "left":
        assert left == pytest.approx(200, abs=1)
    elif align == "right":
        assert right == pytest.approx(600, abs=1)
    else:
        assert (left + right) / 2 == pytest.approx(400, abs=1)
